// src/services/whatsapp.ts

// Configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Vérification des variables d'environnement
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Variables d\'environnement manquantes:', {
    SUPABASE_URL: !!SUPABASE_URL,
    SUPABASE_ANON_KEY: !!SUPABASE_ANON_KEY
  });
  throw new Error("Configuration manquante: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY non défini");
}

interface SendMessageParams {
  to: string;
  message: string;
}

// Register a WhatsApp number
export const registerWhatsAppNumber = async (phoneNumber: string): Promise<{ success: boolean; message: string }> => {
  try {
    // Save to localStorage
    localStorage.setItem('userWhatsAppNumber', phoneNumber);
    
    // Send registration message
    const result = await sendMessage({
      to: phoneNumber,
      message: 'Pour recevoir des messages WhatsApp de notre part, veuillez envoyer le message "join" au numéro +14155238886.'
    });

    return {
      success: result.success,
      message: result.message
    };
  } catch (error) {
    console.error('Error in registerWhatsAppNumber:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during WhatsApp registration'
    };
  }
};

// Envoyer un message WhatsApp
export const sendMessage = async ({ to, message }: SendMessageParams): Promise<{ success: boolean; message: string; sid?: string }> => {
  console.log('Envoi de message WhatsApp à:', to);
  
  try {
    const url = new URL(`${SUPABASE_URL}/functions/v1/whatsapp`);
    
    console.log('URL de la fonction:', url.toString());
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ to, message })
    });
    
    console.log('Statut de la réponse:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erreur dans la réponse:', errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        return { 
          success: false, 
          message: errorData.error || errorData.details || `Erreur serveur: ${response.status}`
        };
      } catch (parseError) {
        return { 
          success: false, 
          message: `Erreur serveur (${response.status}): ${errorText.substring(0, 100) || 'Pas de détails'}`
        };
      }
    }
    
    const data = await response.json();
    return {
      success: true,
      message: data.message || 'Message WhatsApp envoyé avec succès',
      sid: data.sid
    };
  } catch (error) {
    console.error('Erreur dans sendMessage:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur inconnue lors de l\'envoi du message'
    };
  }
};

// Vérifier si un numéro WhatsApp est déjà inscrit au Sandbox
export const verifyWhatsAppNumber = async (phoneNumber: string): Promise<boolean> => {
  try {
    console.log('Vérification du numéro:', phoneNumber);
    
    // Pour vérifier si le numéro est inscrit, nous envoyons un message de test
    // Si le message est accepté par Twilio, cela signifie que le numéro est inscrit
    const result = await sendMessage({
      to: phoneNumber,
      message: "Vérification du numéro WhatsApp"
    });
    
    console.log('Résultat de la vérification:', result);
    
    return result.success;
  } catch (error) {
    console.error('Erreur dans verifyWhatsAppNumber:', error);
    return false;
  }
};

// Fonction pour récupérer le numéro WhatsApp de l'utilisateur courant
export const getUserWhatsAppNumber = async (): Promise<string | null> => {
  // Récupérer depuis le localStorage
  return localStorage.getItem('userWhatsAppNumber');
};

// Fonction pour vérifier si le numéro actuel est vérifié
export const isCurrentNumberVerified = async (): Promise<boolean> => {
  // D'abord, vérifier dans localStorage
  const verifiedInStorage = localStorage.getItem('whatsapp_verified') === 'true';
  if (verifiedInStorage) {
    return true;
  }
  
  // Sinon, vérifier avec l'API
  const phoneNumber = await getUserWhatsAppNumber();
  if (!phoneNumber) {
    return false;
  }
  
  const isVerified = await verifyWhatsAppNumber(phoneNumber);
  
  // Mettre à jour localStorage avec le résultat
  if (isVerified) {
    localStorage.setItem('whatsapp_verified', 'true');
  }
  
  return isVerified;
};

// Fonction pour envoyer un message à l'utilisateur courant
export const sendMessageToCurrentUser = async (message: string): Promise<{ success: boolean; message: string; sid?: string }> => {
  const phoneNumber = await getUserWhatsAppNumber();
  
  if (!phoneNumber) {
    return {
      success: false,
      message: "Numéro WhatsApp non configuré. Veuillez configurer votre numéro dans les paramètres."
    };
  }
  
  return sendMessage({
    to: phoneNumber,
    message
  });
};