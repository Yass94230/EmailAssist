import { createClient } from '@supabase/supabase-js';

interface EmailConfig {
  imap: {
    host: string;
    port: number;
    secure: boolean;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
  auth: {
    user: string;
    pass: string;
  };
}

export async function connectEmail(
  sessionId: string,
  email: string,
  provider: string,
  config?: EmailConfig
): Promise<boolean> {
  try {
    const response = await fetch('/api/email-connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        email,
        provider,
        config
      })
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la connexion email');
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Erreur dans connectEmail:', error);
    throw error;
  }
}

export async function getEmailProvider(email: string): Promise<string> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return 'unknown';

  // Liste des domaines connus
  const providers: Record<string, string> = {
    'gmail.com': 'google',
    'googlemail.com': 'google',
    'outlook.com': 'microsoft',
    'hotmail.com': 'microsoft',
    'yahoo.com': 'yahoo'
  };

  return providers[domain] || 'manual';
}

export async function validateEmailConfig(config: EmailConfig): Promise<boolean> {
  try {
    const response = await fetch('/api/email-validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      throw new Error('Configuration email invalide');
    }

    const data = await response.json();
    return data.valid;
  } catch (error) {
    console.error('Erreur dans validateEmailConfig:', error);
    return false;
  }
}