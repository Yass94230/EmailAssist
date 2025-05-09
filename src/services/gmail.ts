// services/gmail.ts - Service pour interagir avec l'API Gmail
import { supabase } from './supabase';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

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