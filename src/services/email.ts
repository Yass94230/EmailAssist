import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Configuration Supabase manquante');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function generateEmailConnectionLink(phoneNumber: string): Promise<string> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/email-connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ phoneNumber })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors de la génération du lien');
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Erreur dans generateEmailConnectionLink:', error);
    throw error;
  }
}

export async function getEmailCredentials(phoneNumber: string) {
  try {
    const { data, error } = await supabase
      .from('email_credentials')
      .select('email, provider')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erreur dans getEmailCredentials:', error);
    return null;
  }
}