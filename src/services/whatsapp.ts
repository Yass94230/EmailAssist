// services/whatsapp.ts
import { supabase } from './supabase';
import { TwilioResponse } from '../types';

/**
 * Formats a phone number to ensure it starts with + and contains only digits
 */
function formatPhoneNumber(number: string): string {
  // Remove all non-digit characters except +
  const cleaned = number.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

/**
 * Registers a WhatsApp number for the current user
 */
export async function registerWhatsAppNumber(phoneNumber: string): Promise<void> {
  try {
    const formattedNumber = formatPhoneNumber(phoneNumber);

    // Check if the phone number is already registered in user_settings
    const { data: existingSettings } = await supabase
      .from('user_settings')
      .select('id')
      .eq('phone_number', formattedNumber)
      .single();

    // If settings exist, update them. If not, insert new settings.
    const { error: settingsError } = await supabase
      .from('user_settings')
      .upsert({
        phone_number: formattedNumber,
        audio_enabled: true,
        voice_type: 'alloy',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'phone_number'
      });
    
    if (settingsError) throw settingsError;

    // Register WhatsApp number
    const { error: whatsappError } = await supabase
      .from('user_whatsapp')
      .upsert({
        phone_number: formattedNumber,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'phone_number'
      });

    if (whatsappError) throw whatsappError;

    // Save in localStorage for quick access
    localStorage.setItem('userWhatsAppNumber', formattedNumber);
  } catch (error) {
    console.error('Error registering WhatsApp number:', error);
    throw error;
  }
}

/**
 * Sends a WhatsApp message
 */
export async function sendWhatsAppMessage(to: string, message: string): Promise<TwilioResponse> {
  try {
    const formattedTo = formatPhoneNumber(to);
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ 
        to: formattedTo,
        message 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

/**
 * Verifies if a WhatsApp number is registered and active
 */
export async function verifyWhatsAppNumber(phoneNumber: string): Promise<boolean> {
  try {
    const formattedNumber = formatPhoneNumber(phoneNumber);
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ phoneNumber: formattedNumber }),
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const { verified } = await response.json();
    
    if (verified) {
      localStorage.setItem('whatsapp_verified', 'true');
    }
    
    return verified;
  } catch (error) {
    console.error('Error verifying WhatsApp number:', error);
    return false;
  }
}

/**
 * Gets the current user's WhatsApp number
 */
export async function getCurrentWhatsAppNumber(): Promise<string | null> {
  try {
    // First check localStorage for better performance
    const cachedNumber = localStorage.getItem('userWhatsAppNumber');
    if (cachedNumber) return cachedNumber;

    // If not in localStorage, check database
    const { data, error } = await supabase
      .from('user_whatsapp')
      .select('phone_number')
      .single();

    if (error) throw error;
    if (!data) return null;

    // Cache the number in localStorage
    localStorage.setItem('userWhatsAppNumber', data.phone_number);
    return data.phone_number;
  } catch (error) {
    console.error('Error getting WhatsApp number:', error);
    return null;
  }
}

/**
 * Checks if the current WhatsApp number is verified
 */
export async function isWhatsAppVerified(): Promise<boolean> {
  try {
    // Check localStorage first
    if (localStorage.getItem('whatsapp_verified') === 'true') {
      return true;
    }

    const phoneNumber = await getCurrentWhatsAppNumber();
    if (!phoneNumber) return false;

    return await verifyWhatsAppNumber(phoneNumber);
  } catch (error) {
    console.error('Error checking WhatsApp verification:', error);
    return false;
  }
}

/**
 * Sends a message to the current user's WhatsApp
 */
export async function sendMessageToCurrentUser(message: string): Promise<TwilioResponse> {
  const phoneNumber = await getCurrentWhatsAppNumber();
  if (!phoneNumber) {
    throw new Error('No WhatsApp number configured');
  }

  return sendWhatsAppMessage(phoneNumber, message);
}