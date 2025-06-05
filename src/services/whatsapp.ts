import { TwilioResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL;

export const sendMessage = async (to: string, message: string): Promise<TwilioResponse> => {
  try {
    const response = await fetch(`${API_URL}/twilio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        message,
        from: import.meta.env.VITE_TWILIO_PHONE_NUMBER,
        channel: 'whatsapp'
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const verifyWhatsAppNumber = async (phoneNumber: string): Promise<boolean> => {
  try {
    const result = await sendMessage(phoneNumber, "WhatsApp number verification");
    return result.success;
  } catch (error) {
    console.error('Error in verifyWhatsAppNumber:', error);
    return false;
  }
};

export const getUserWhatsAppNumber = (): string | null => {
  return localStorage.getItem('userWhatsAppNumber');
};

export const sendMessageToCurrentUser = async (message: string): Promise<TwilioResponse> => {
  const phoneNumber = getUserWhatsAppNumber();
  
  if (!phoneNumber) {
    return {
      success: false,
      message: "WhatsApp number not configured",
      error: "WhatsApp number not configured. Please set up your number in settings."
    };
  }
  
  return sendMessage(phoneNumber, message);
};