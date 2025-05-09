import { EmailMessage } from '../types';
import { applyRules } from './emailRules';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export const fetchEmails = async (accessToken: string): Promise<EmailMessage[]> => {
  try {
    const response = await fetch(`${GMAIL_API_BASE}/messages?maxResults=20`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des emails');
    }

    const data = await response.json();
    const emails: EmailMessage[] = [];

    for (const message of data.messages) {
      const emailResponse = await fetch(`${GMAIL_API_BASE}/messages/${message.id}?format=full`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        const headers = emailData.payload.headers;
        
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(Sans objet)';
        const fromHeader = headers.find((h: any) => h.name === 'From')?.value || '';
        const [senderName, senderEmail] = parseFromHeader(fromHeader);

        let body = '';
        if (emailData.payload.parts) {
          const textPart = emailData.payload.parts.find((part: any) => part.mimeType === 'text/plain');
          if (textPart && textPart.body.data) {
            body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
        } else if (emailData.payload.body.data) {
          body = atob(emailData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }

        const email: EmailMessage = {
          id: emailData.id,
          accountId: 'gmail',
          subject,
          sender: senderName,
          senderEmail,
          preview: emailData.snippet || '',
          body,
          date: new Date(parseInt(emailData.internalDate)),
          isRead: !emailData.labelIds.includes('UNREAD'),
          isPriority: emailData.labelIds.includes('IMPORTANT'),
          category: 'primary',
          hasAttachments: emailData.payload.parts?.some((part: any) => part.filename) || false,
          hasEvent: false,
          labels: emailData.labelIds
        };

        emails.push(email);
      }
    }

    return emails;
  } catch (error) {
    console.error('Erreur lors de la récupération des emails:', error);
    throw error;
  }
};

const parseFromHeader = (fromHeader: string): [string, string] => {
  // Handle empty or invalid input
  if (!fromHeader) {
    return ['', ''];
  }

  try {
    // Try to match "Name <email@domain.com>" format
    const nameEmailMatch = fromHeader.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]*)>?$/);
    if (nameEmailMatch) {
      const [, name, email] = nameEmailMatch;
      // If no name is provided, use the email as the name
      return [name?.trim() || email.trim(), email.trim()];
    }

    // If no match, assume the entire string is an email
    return [fromHeader.trim(), fromHeader.trim()];
  } catch (error) {
    console.error('Error parsing From header:', error);
    return [fromHeader, fromHeader];
  }
};

export const sendEmail = async (accessToken: string, to: string, subject: string, body: string): Promise<void> => {
  try {
    const email = [
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      body
    ].join('\r\n');

    const encodedEmail = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_');

    const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedEmail,
      }),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de l\'envoi de l\'email');
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    throw error;
  }
};

export const markAsRead = async (accessToken: string, messageId: string): Promise<void> => {
  try {
    const response = await fetch(`${GMAIL_API_BASE}/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: ['UNREAD'],
      }),
    });

    if (!response.ok) {
      throw new Error('Erreur lors du marquage comme lu');
    }
  } catch (error) {
    console.error('Erreur lors du marquage comme lu:', error);
    throw error;
  }
};

export const searchEmails = async (accessToken: string, query: string): Promise<EmailMessage[]> => {
  try {
    const response = await fetch(
      `${GMAIL_API_BASE}/messages?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Erreur lors de la recherche des emails');
    }

    const data = await response.json();
    const emails: EmailMessage[] = [];

    for (const message of data.messages || []) {
      const emailResponse = await fetch(`${GMAIL_API_BASE}/messages/${message.id}?format=full`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        const headers = emailData.payload.headers;
        
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(Sans objet)';
        const fromHeader = headers.find((h: any) => h.name === 'From')?.value || '';
        const [senderName, senderEmail] = parseFromHeader(fromHeader);

        let body = '';
        if (emailData.payload.parts) {
          const textPart = emailData.payload.parts.find((part: any) => part.mimeType === 'text/plain');
          if (textPart && textPart.body.data) {
            body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
        } else if (emailData.payload.body.data) {
          body = atob(emailData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }

        emails.push({
          id: emailData.id,
          accountId: 'gmail',
          subject,
          sender: senderName,
          senderEmail,
          preview: emailData.snippet || '',
          body,
          date: new Date(parseInt(emailData.internalDate)),
          isRead: !emailData.labelIds.includes('UNREAD'),
          isPriority: emailData.labelIds.includes('IMPORTANT'),
          category: 'primary',
          hasAttachments: emailData.payload.parts?.some((part: any) => part.filename) || false,
          hasEvent: false,
          labels: emailData.labelIds
        });
      }
    }

    return emails;
  } catch (error) {
    console.error('Erreur lors de la recherche des emails:', error);
    throw error;
  }
};

export const moveToLabel = async (accessToken: string, messageId: string, labelId: string): Promise<void> => {
  try {
    const response = await fetch(`${GMAIL_API_BASE}/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: [labelId],
        removeLabelIds: ['INBOX'],
      }),
    });

    if (!response.ok) {
      throw new Error('Erreur lors du déplacement de l\'email');
    }
  } catch (error) {
    console.error('Erreur lors du déplacement de l\'email:', error);
    throw error;
  }
};