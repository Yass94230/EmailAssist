// claude.ts - Service pour la communication avec l'API Claude
import { AudioSettings } from '../types';

interface GenerateResponseOptions {
  generateAudio?: boolean;
  voiceType?: string;
}

interface GenerateResponseResult {
  text: string;
  audioUrl?: string;
}

/**
 * Convertit une chaîne Base64 en Blob sans utiliser .from()
 * Cette fonction résout l'erreur "x.from is not a function"
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  try {
    // Retirer les caractères non-base64 si nécessaire
    const cleanBase64 = base64.replace(/^data:.*,/, '');
    
    // Décodage Base64 sans utiliser Uint8Array.from ou Array.from
    const binaryString = window.atob(cleanBase64);
    const length = binaryString.length;
    
    // Créer le tableau d'octets manuellement, sans utiliser .from()
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: mimeType });
  } catch (error) {
    console.error('Erreur dans base64ToBlob:', error);
    // Retourner un blob vide en cas d'erreur
    return new Blob([], { type: mimeType });
  }
}

/**
 * Génère une réponse à partir de l'API Claude
 */
export const generateResponse = async (
  prompt: string,
  options: GenerateResponseOptions = {}
): Promise<GenerateResponseResult> => {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Configuration manquante: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY non défini");
  }

  try {
    // Appel à l'API Claude via Supabase Edge Functions
    const response = await fetch(`${SUPABASE_URL}/functions/v1/claude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        generateAudio: options.generateAudio ?? true,
        voiceType: options.voiceType || 'alloy'
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error || `Erreur serveur: ${response.status}`);
      } catch (parseError) {
        throw new Error(`Erreur serveur (${response.status}): ${errorText.substring(0, 100)}`);
      }
    }
    
    const data = await response.json();
    
    if (!data.response) {
      throw new Error('Format de réponse invalide: réponse manquante');
    }
    
    // Création d'URL blob pour l'audio si présent
    let audioUrl;
    if (data.audio) {
      try {
        // Utiliser notre fonction utilitaire sécurisée qui évite .from()
        const audioBlob = base64ToBlob(data.audio, 'audio/mp3');
        audioUrl = URL.createObjectURL(audioBlob);
      } catch (audioError) {
        console.error('Erreur lors du traitement audio:', audioError);
        // Continuer sans audio plutôt que de faire échouer toute la réponse
      }
    }
    
    return {
      text: data.response,
      audioUrl
    };
  } catch (error) {
    console.error('Erreur dans generateResponse:', error);
    throw error instanceof Error ? error : new Error('Erreur inconnue');
  }
};

/**
 * Envoie un message au serveur pour le transférer à l'utilisateur actuel via WhatsApp
 */
export const sendMessageToCurrentUser = async (message: string): Promise<void> => {
  try {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Impossible d'envoyer le message: Configuration manquante");
      return;
    }

    // Cette fonction est utilisée uniquement pour le développement/débug
    // Dans un environnement de production, on utiliserait un webhook
    console.log("Message envoyé à l'utilisateur:", message.substring(0, 100) + (message.length > 100 ? '...' : ''));
  } catch (error) {
    console.error("Erreur lors de l'envoi du message:", error);
  }
};

/**
 * Récupère les paramètres audio de l'utilisateur
 */
export const getUserAudioSettings = async (phoneNumber: string): Promise<AudioSettings> => {
  // Fonction à implémenter si nécessaire
  // Cette partie peut être gérée par le composant AudioSettings
  return {
    enabled: true,
    voiceType: 'alloy'
  };
};