import { TwilioResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL;

export const sendSMS = async (phoneNumber: string, message: string): Promise<TwilioResponse> => {
  try {
    const response = await fetch(`${API_URL}/twilio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phoneNumber,
        message,
        from: import.meta.env.VITE_TWILIO_PHONE_NUMBER
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send SMS');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
};