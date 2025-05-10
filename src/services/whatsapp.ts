// src/services/whatsapp.ts
import { TwilioResponse } from '../types';

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
      message: error instanceof Error ? error.message : 'Unknown error during WhatsApp registration'
    };
  }
};

// Send a WhatsApp message
export const sendMessage = async ({ to, message }: SendMessageParams): Promise<{ success: boolean; message: string; sid?: string }> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ to, message })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send message');
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || 'Message sent successfully',
      sid: data.sid
    };
  } catch (error) {
    console.error('Error in sendMessage:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Verify if a WhatsApp number is registered
export const verifyWhatsAppNumber = async (phoneNumber: string): Promise<boolean> => {
  try {
    const result = await sendMessage({
      to: phoneNumber,
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
  return localStorage.getItem('userWhatsAppNumber');
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
  
  return sendMessage({
    to: phoneNumber,
    message
  });
};