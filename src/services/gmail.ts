// services/gmail.ts - Service pour interagir avec l'API Gmail
import { supabase } from './supabase';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Types
export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  sender: string;
  senderEmail: string;
  snippet: string;
  body?: string;
  date: Date;
  isRead: boolean;
  isStarred: boolean;
  labelIds: string[];
  hasAttachments: boolean;
}

export interface GetEmailsParams {
  maxResults?: number;
  query?: string;
  labelIds?: string[];
  pageToken?: string;
}

export interface EmailsResponse {
  messages: EmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // Base64
}

/**
 * Récupère les tokens d'accès pour un numéro de téléphone donné
 */
export async function getGmailTokens(phoneNumber: string): Promise<{ accessToken: string; email: string } | null> {
  try {
    const { data, error } = await supabase
      .from('gmail_credentials')
      .select('email, access_token, refresh_token, token_expires_at')
      .eq('phone_number', phoneNumber)
      .single();
    
    if (error || !data) {
      console.error('Erreur lors de la récupération des tokens Gmail:', error);
      return null;
    }
    
    // Vérifier si le token est expiré
    if (new Date(data.token_expires_at) <= new Date()) {
      // Rafraîchir le token
      if (!data.refresh_token) {
        console.error('Pas de refresh token disponible');
        return null;
      }
      
      // Appeler la fonction de rafraîchissement
      const refreshed = await refreshAccessToken(phoneNumber, data.refresh_token);
      if (!refreshed) {
        return null;
      }
      
      return {
        accessToken: refreshed.accessToken,
        email: data.email
      };
    }
    
    return {
      accessToken: data.access_token,
      email: data.email
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des tokens Gmail:', error);
    return null;
  }
}

/**
 * Rafraîchit le token d'accès
 */
async function refreshAccessToken(phoneNumber: string, refreshToken: string): Promise<{ accessToken: string } | null> {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        phoneNumber,
        refreshToken
      })
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors du rafraîchissement du token: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      accessToken: data.access_token
    };
  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token:', error);
    return null;
  }
}

/**
 * Récupère les emails
 */
export async function getEmails(
  phoneNumber: string, 
  params: GetEmailsParams = {}
): Promise<EmailsResponse | null> {
  try {
    const tokens = await getGmailTokens(phoneNumber);
    if (!tokens) {
      throw new Error('Tokens Gmail non disponibles');
    }
    
    // Construire l'URL avec les paramètres
    const url = new URL(`${GMAIL_API_BASE}/messages`);
    url.searchParams.append('maxResults', String(params.maxResults || 20));
    
    if (params.query) {
      url.searchParams.append('q', params.query);
    }
    
    if (params.labelIds && params.labelIds.length > 0) {
      url.searchParams.append('labelIds', params.labelIds.join(','));
    }
    
    if (params.pageToken) {
      url.searchParams.append('pageToken', params.pageToken);
    }
    
    // Récupérer la liste des messages
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération des emails: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Si aucun message n'est trouvé
    if (!data.messages || data.messages.length === 0) {
      return {
        messages: [],
        resultSizeEstimate: 0
      };
    }
    
    // Récupérer les détails de chaque message
    const messagePromises = data.messages.map(async (message: { id: string }) => {
      return getEmailDetails(tokens.accessToken, message.id);
    });
    
    const messages = await Promise.all(messagePromises);
    
    return {
      messages: messages.filter(Boolean) as EmailMessage[],
      nextPageToken: data.nextPageToken,
      resultSizeEstimate: data.resultSizeEstimate
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des emails:', error);
    return null;
  }
}

/**
 * Récupère les détails d'un email
 */
export async function getEmailDetails(accessToken: string, messageId: string): Promise<EmailMessage | null> {
  try {
    const response = await fetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération des détails de l'email: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extraire les informations pertinentes
    const headers = data.payload.headers;
    const subject = headers.find((h: { name: string }) => h.name === 'Subject')?.value || '(Sans objet)';
    const from = headers.find((h: { name: string }) => h.name === 'From')?.value || '';
    
    // Extraire le nom et l'email de l'expéditeur
    let sender = from;
    let senderEmail = from;
    
    const fromMatch = from.match(/^(.*?)\s?<(.+)>$/);
    if (fromMatch) {
      sender = fromMatch[1].trim().replace(/"/g, '') || '(Sans nom)';
      senderEmail = fromMatch[2];
    }
    
    // Extraire la date
    const dateHeader = headers.find((h: { name: string }) => h.name === 'Date')?.value;
    const date = dateHeader ? new Date(dateHeader) : new Date();
    
    // Extraire le corps du message
    let body = '';
    if (data.payload.parts) {
      // Message multipart
      const textPart = data.payload.parts.find(
        (part: any) => part.mimeType === 'text/plain' || part.mimeType === 'text/html'
      );
      
      if (textPart && textPart.body.data) {
        body = decodeBase64Url(textPart.body.data);
      }
    } else if (data.payload.body.data) {
      // Message simple
      body = decodeBase64Url(data.payload.body.data);
    }
    
    // Vérifier si l'email a des pièces jointes
    const hasAttachments = hasEmailAttachments(data);
    
    return {
      id: data.id,
      threadId: data.threadId,
      subject,
      sender,
      senderEmail,
      snippet: data.snippet,
      body,
      date,
      isRead: !data.labelIds.includes('UNREAD'),
      isStarred: data.labelIds.includes('STARRED'),
      labelIds: data.labelIds,
      hasAttachments
    };
  } catch (error) {
    console.error(`Erreur lors de la récupération des détails de l'email ${messageId}:`, error);
    return null;
  }
}

/**
 * Vérifie si un email a des pièces jointes
 */
function hasEmailAttachments(message: any): boolean {
  if (!message.payload) return false;
  
  // Vérifier si l'email a des parties
  if (message.payload.parts) {
    return message.payload.parts.some((part: any) => {
      // Vérifier les pièces jointes directement
      if (part.filename && part.filename.length > 0) {
        return true;
      }
      
      // Vérifier récursivement les sous-parties
      if (part.parts) {
        return part.parts.some((subPart: any) => 
          subPart.filename && subPart.filename.length > 0
        );
      }
      
      return false;
    });
  }
  
  return false;
}

/**
 * Récupère les pièces jointes d'un email
 */
export async function getEmailAttachments(
  accessToken: string, 
  messageId: string
): Promise<EmailAttachment[]> {
  try {
    const response = await fetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération des pièces jointes: ${response.statusText}`);
    }
    
    const data = await response.json();
    const attachments: EmailAttachment[] = [];
    
    // Fonction récursive pour extraire les pièces jointes
    function extractAttachments(parts: any[]) {
      if (!parts) return;
      
      for (const part of parts) {
        if (part.filename && part.filename.length > 0 && part.body.attachmentId) {
          attachments.push({
            id: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size || 0
          });
        }
        
        if (part.parts) {
          extractAttachments(part.parts);
        }
      }
    }
    
    if (data.payload && data.payload.parts) {
      extractAttachments(data.payload.parts);
    }
    
    return attachments;
  } catch (error) {
    console.error('Erreur lors de la récupération des pièces jointes:', error);
    return [];
  }
}

/**
 * Récupère une pièce jointe spécifique
 */
export async function getAttachmentData(
  accessToken: string, 
  messageId: string, 
  attachmentId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${GMAIL_API_BASE}/messages/${messageId}/attachments/${attachmentId}`, 
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération de la pièce jointe: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data; // Données Base64
  } catch (error) {
    console.error('Erreur lors de la récupération de la pièce jointe:', error);
    return null;
  }
}

/**
 * Marque un message comme lu ou non lu
 */
export async function markAsRead(
  phoneNumber: string, 
  messageId: string, 
  read: boolean = true
): Promise<boolean> {
  try {
    const tokens = await getGmailTokens(phoneNumber);
    if (!tokens) {
      throw new Error('Tokens Gmail non disponibles');
    }
    
    const response = await fetch(`${GMAIL_API_BASE}/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        removeLabelIds: read ? ['UNREAD'] : [],
        addLabelIds: read ? [] : ['UNREAD']
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Erreur lors du marquage du message:', error);
    return false;
  }
}

/**
 * Décode une chaîne Base64 URL-safe
 */
function decodeBase64Url(base64Url: string): string {
  // Convertir Base64 URL-safe en Base64 standard
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  
  try {
    // Décodage Base64
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch (error) {
    console.error('Erreur lors du décodage Base64:', error);
    return '';
  }
}