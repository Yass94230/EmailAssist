import { supabase } from './supabase';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export async function getGmailTokens(phoneNumber: string): Promise<{ accessToken: string; email: string } | null> {
  try {
    const { data, error } = await supabase
      .from('gmail_credentials')
      .select('email, access_token, refresh_token, token_expires_at')
      .eq('phone_number', phoneNumber)
      .maybeSingle(); // Changed from single() to maybeSingle() to handle no results gracefully
    
    if (error) {
      console.error('Error retrieving Gmail tokens:', error);
      return null;
    }
    
    if (!data) {
      console.log('No Gmail credentials found for phone number:', phoneNumber);
      return null;
    }
    
    // Check if token is expired
    if (new Date(data.token_expires_at) <= new Date()) {
      // Refresh token
      if (!data.refresh_token) {
        console.error('No refresh token available');
        return null;
      }
      
      // Call refresh function
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
    console.error('Error retrieving Gmail tokens:', error);
    return null;
  }
}

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
      throw new Error(`Error refreshing token: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      accessToken: data.access_token
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}