import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Configuration Supabase manquante');
  throw new Error('Configuration Supabase manquante');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Génère un lien de connexion unique pour l'authentification de l'email
 * @param phoneNumber Le numéro de téléphone de l'utilisateur
 * @returns Le lien de connexion généré
 */
export async function generateEmailConnectionLink(phoneNumber: string): Promise<string> {
  console.log("Début de la génération du lien pour:", phoneNumber);
  
  if (!phoneNumber) {
    console.error("Numéro de téléphone manquant");
    throw new Error("Le numéro de téléphone est requis");
  }
  
  try {
    // Vérification de la configuration
    if (!supabaseUrl || !supabaseKey) {
      console.error("Configuration Supabase manquante");
      throw new Error("Configuration Supabase manquante");
    }
    
    console.log("Appel à la fonction Supabase email-connect");
    
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
      console.error("Erreur de la fonction email-connect:", errorData);
      throw new Error(errorData.error || 'Erreur lors de la génération du lien');
    }

    const data = await response.json();
    console.log("Lien généré avec succès:", data.url);
    
    if (!data.url) {
      throw new Error("La réponse ne contient pas d'URL");
    }
    
    return data.url;
  } catch (error) {
    console.error('Erreur détaillée dans generateEmailConnectionLink:', error);
    
    // Relancer l'erreur avec un message plus descriptif
    if (error instanceof Error) {
      throw new Error(`Erreur lors de la génération du lien: ${error.message}`);
    } else {
      throw new Error('Erreur inconnue lors de la génération du lien de connexion');
    }
  }
}

/**
 * Récupère les identifiants email d'un utilisateur
 * @param phoneNumber Le numéro de téléphone de l'utilisateur
 * @returns Les identifiants email ou null si non trouvés
 */
export async function getEmailCredentials(phoneNumber: string) {
  if (!phoneNumber) {
    console.error("Numéro de téléphone manquant");
    return null;
  }
  
  try {
    console.log("Récupération des identifiants email pour:", phoneNumber);
    
    const { data, error } = await supabase
      .from('email_credentials')
      .select('email, provider')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (error) {
      console.error("Erreur Supabase:", error);
      throw error;
    }

    console.log("Identifiants récupérés:", data ? "Trouvés" : "Non trouvés");
    return data;
  } catch (error) {
    console.error('Erreur détaillée dans getEmailCredentials:', error);
    return null;
  }
}

/**
 * Vérifie le statut d'une session de connexion email
 * @param sessionId L'identifiant de la session de connexion
 * @returns Le statut de la session ou null en cas d'erreur
 */
export async function checkEmailConnectionStatus(sessionId: string) {
  if (!sessionId) {
    console.error("ID de session manquant");
    return null;
  }
  
  try {
    console.log("Vérification du statut de la session:", sessionId);
    
    const { data, error } = await supabase
      .from('email_connection_sessions')
      .select('status, phone_number')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      console.error("Erreur Supabase:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erreur dans checkEmailConnectionStatus:', error);
    return null;
  }
}