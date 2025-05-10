// services/whatsapp.ts
import { supabase } from './supabase';
import { TwilioResponse } from '../types';

/**
 * Enregistre un numéro WhatsApp pour l'utilisateur actuel
 */
export async function registerWhatsAppNumber(phoneNumber: string): Promise<void> {
  try {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Configuration Supabase manquante");
    }
    
    // Récupérer le token d'authentification actuel
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    const token = session?.access_token;
    
    // Appeler la fonction Edge pour enregistrer le numéro
    const response = await fetch(`${SUPABASE_URL}/functions/v1/user-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ phoneNumber }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
    }
    
    await response.json();
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du numéro WhatsApp:', error);
    throw error;
  }
}

/**
 * Envoie un message WhatsApp
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string,
  from?: string
): Promise<TwilioResponse> {
  try {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Configuration Supabase manquante");
    }
    
    // Format the phone number: remove spaces and ensure it starts with +
    const formattedTo = to.startsWith('+') ? to : `+${to}`;
    const defaultFrom = import.meta.env.VITE_DEFAULT_WHATSAPP_NUMBER || '+14155238886';
    const formattedFrom = from ? (from.startsWith('+') ? from : `+${from}`) : defaultFrom;
    
    // Appeler la fonction Edge pour envoyer le message
    const response = await fetch(`${SUPABASE_URL}/functions/v1/twilio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        to: formattedTo,
        from: formattedFrom,
        message,
        channel: 'whatsapp'
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message WhatsApp:', error);
    throw error;
  }
}

/**
 * Vérifie si un numéro est enregistré pour WhatsApp
 */
export async function verifyWhatsAppNumber(phoneNumber: string): Promise<{ isRegistered: boolean }> {
  try {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Configuration Supabase manquante");
    }
    
    // Format the phone number
    const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    
    // Appeler la fonction Edge pour vérifier le numéro
    const response = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ phoneNumber: formattedNumber }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return { isRegistered: data.isRegistered };
  } catch (error) {
    console.error('Erreur lors de la vérification du numéro WhatsApp:', error);
    return { isRegistered: false };
  }
}

/**
 * Récupère le numéro WhatsApp associé à l'utilisateur actuel
 */
export async function getUserWhatsAppNumber(): Promise<string | null> {
  try {
    // Récupérer l'ID utilisateur actuel
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }
    
    // Récupérer le numéro WhatsApp associé à l'utilisateur
    const { data, error } = await supabase
      .from('user_whatsapp')
      .select('phone_number')
      .eq('user_id', user.id)
      .single();
      
    if (error || !data) {
      return null;
    }
    
    return data.phone_number;
  } catch (error) {
    console.error('Erreur lors de la récupération du numéro WhatsApp:', error);
    return null;
  }
}