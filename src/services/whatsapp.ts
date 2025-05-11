// src/services/whatsapp.ts

interface SendMessageParams {
  to: string;
  message: string;
}

// Validate phone number format
const isValidPhoneNumber = (phoneNumber: string): boolean => {
  // Check for international format with optional + prefix
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber.replace(/\s+/g, ''));
};

// Validate message content
const isValidMessage = (message: string): boolean => {
  return message.length > 0 && message.length <= 4096; // WhatsApp message length limit
};

// Register a WhatsApp number
export const registerWhatsAppNumber = async (phoneNumber: string): Promise<{ success: boolean; message: string }> => {
  try {
    if (!isValidPhoneNumber(phoneNumber)) {
      throw new Error('Format de numéro de téléphone invalide. Utilisez le format international (ex: +33612345678)');
    }

    // Normalize phone number
    const normalizedPhone = phoneNumber.replace(/\s+/g, '');
    
    // Save to localStorage
    localStorage.setItem('userWhatsAppNumber', normalizedPhone);
    
    // Send registration message
    const result = await sendMessage({
      to: normalizedPhone,
      message: 'Pour activer votre compte WhatsApp, veuillez envoyer le message "join police-hour" au numéro +14155238886.'
    });

    return {
      success: result.success,
      message: result.message
    };
  } catch (error) {
    console.error('Error in registerWhatsAppNumber:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur inconnue lors de l\'enregistrement WhatsApp'
    };
  }
};

// Send a WhatsApp message
export const sendMessage = async ({ to, message }: SendMessageParams): Promise<{ success: boolean; message: string; sid?: string }> => {
  try {
    // Validate inputs
    if (!to || !message) {
      throw new Error('Le numéro de téléphone et le message sont requis');
    }

    if (!isValidPhoneNumber(to)) {
      throw new Error('Format de numéro de téléphone invalide');
    }

    if (!isValidMessage(message)) {
      throw new Error('Message invalide ou trop long (maximum 4096 caractères)');
    }

    // Normalize phone number
    const normalizedPhone = to.replace(/\s+/g, '');

    // Check for required environment variables
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      throw new Error('Configuration Supabase manquante');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ 
        to: normalizedPhone,
        message
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Erreur de réponse du serveur' }));
      throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Échec de l\'envoi du message');
    }

    return {
      success: true,
      message: data.message || 'Message envoyé avec succès',
      sid: data.sid
    };
  } catch (error) {
    console.error('Error in sendMessage:', error);
    
    let errorMessage = 'Erreur lors de l\'envoi du message WhatsApp';
    
    if (error instanceof Error) {
      // Customize error messages for common issues
      if (error.message.includes('Configuration Supabase')) {
        errorMessage = 'Erreur de configuration du service de messagerie';
      } else if (error.message.includes('numéro de téléphone invalide')) {
        errorMessage = 'Format de numéro de téléphone incorrect';
      } else if (error.message.includes('Message invalide')) {
        errorMessage = 'Message invalide ou trop long';
      } else if (error.message.includes('429')) {
        errorMessage = 'Trop de messages envoyés. Veuillez réessayer plus tard.';
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'Erreur d\'authentification avec le service de messagerie';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      message: errorMessage
    };
  }
};

// Verify if a WhatsApp number is registered
export const verifyWhatsAppNumber = async (phoneNumber: string): Promise<boolean> => {
  try {
    if (!isValidPhoneNumber(phoneNumber)) {
      console.error('Format de numéro de téléphone invalide lors de la vérification');
      return false;
    }

    const normalizedPhone = phoneNumber.replace(/\s+/g, '');
    
    const result = await sendMessage({
      to: normalizedPhone,
      message: "Vérification du numéro WhatsApp"
    });
    
    return result.success;
  } catch (error) {
    console.error('Error in verifyWhatsAppNumber:', error);
    return false;
  }
};

// Get the current user's WhatsApp number
export const getUserWhatsAppNumber = async (): Promise<string | null> => {
  const phoneNumber = localStorage.getItem('userWhatsAppNumber');
  return phoneNumber && isValidPhoneNumber(phoneNumber) ? phoneNumber : null;
};

// Check if the current number is verified
export const isCurrentNumberVerified = async (): Promise<boolean> => {
  const verifiedInStorage = localStorage.getItem('whatsapp_verified') === 'true';
  if (verifiedInStorage) {
    return true;
  }
  
  const phoneNumber = await getUserWhatsAppNumber();
  if (!phoneNumber) {
    return false;
  }
  
  const isVerified = await verifyWhatsAppNumber(phoneNumber);
  
  if (isVerified) {
    localStorage.setItem('whatsapp_verified', 'true');
  }
  
  return isVerified;
};

// Send a message to the current user
export const sendMessageToCurrentUser = async (message: string): Promise<{ success: boolean; message: string; sid?: string }> => {
  const phoneNumber = await getUserWhatsAppNumber();
  
  if (!phoneNumber) {
    return {
      success: false,
      message: "Numéro WhatsApp non configuré. Veuillez configurer votre numéro dans les paramètres."
    };
  }

  if (!isValidMessage(message)) {
    return {
      success: false,
      message: "Message invalide ou trop long (maximum 4096 caractères)"
    };
  }
  
  return sendMessage({
    to: phoneNumber,
    message
  });
};