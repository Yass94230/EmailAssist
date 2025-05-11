import { createClient } from '@supabase/supabase-js';

interface GenerateResponseOptions {
  generateAudio?: boolean;
  voiceType?: string;
  phoneNumber: string;
  isAudioInput?: boolean;
  audioData?: string;
}

interface GenerateResponseResult {
  text: string;
  audioUrl?: string;
}

// Validation de la taille maximale des données audio (10MB en base64)
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;

// Validation du format des données audio
function isValidAudioData(data: string): boolean {
  // Vérifie si c'est une chaîne base64 valide
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(data);
}

export async function generateResponse(
  prompt: string,
  options: GenerateResponseOptions
): Promise<GenerateResponseResult> {
  try {
    console.log("Envoi de la requête à l'API Claude avec les options :", {
      longueurPrompt: prompt.length,
      estEntréeAudio: options.isAudioInput,
      contientAudio: !!options.audioData,
      generateAudio: options.generateAudio,
      voiceType: options.voiceType,
      phoneNumber: options.phoneNumber ? options.phoneNumber.substring(0, 4) + '****' : 'non défini'
    });

    // Validation améliorée des données audio
    if (options.isAudioInput) {
      if (!options.audioData) {
        throw new Error("Les données audio sont requises pour le traitement audio");
      }

      if (options.audioData.length > MAX_AUDIO_SIZE) {
        throw new Error("Le fichier audio est trop volumineux (maximum 10MB)");
      }

      if (!isValidAudioData(options.audioData)) {
        throw new Error("Format des données audio invalide");
      }
    }

    const corpsRequête = {
      prompt,
      phoneNumber: options.phoneNumber,
      generateAudio: options.generateAudio || false,
      voiceType: options.voiceType || 'alloy',
      isAudioInput: options.isAudioInput || false,
      audioData: options.audioData ? options.audioData.trim() : undefined
    };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuration Supabase manquante (URL ou clé API)");
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/claude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(corpsRequête)
    });

    if (!response.ok) {
      const texteErreur = await response.text();
      let donnéesErreur;
      try {
        donnéesErreur = JSON.parse(texteErreur);
      } catch (e) {
        donnéesErreur = { error: texteErreur };
      }
      
      console.error("Réponse d'erreur de l'API Claude :", {
        statut: response.status,
        texteStatut: response.statusText,
        donnéesErreur
      });
      
      // Messages d'erreur plus spécifiques basés sur le code de statut
      switch (response.status) {
        case 400:
          throw new Error("Format de données audio non valide ou corrompu");
        case 413:
          throw new Error("Fichier audio trop volumineux");
        case 429:
          throw new Error("Trop de requêtes. Veuillez réessayer dans quelques instants");
        case 500:
          throw new Error("Erreur du serveur lors du traitement audio. Veuillez réessayer");
        default:
          throw new Error(
            donnéesErreur?.error || donnéesErreur?.details || 
            `Erreur ${response.status}: ${response.statusText}`
          );
      }
    }

    const données = await response.json();
    
    if (!données || typeof données.response !== 'string') {
      console.error("Structure de réponse invalide:", données);
      throw new Error("Réponse invalide du serveur");
    }

    return {
      text: données.response,
      audioUrl: données.audio
    };
  } catch (error) {
    console.error('Erreur détaillée dans generateResponse:', error);
    
    let messageErreur = "Une erreur est survenue lors de la génération de la réponse";
    
    if (error instanceof Error) {
      if (error.message.includes("413") || error.message.includes("trop volumineux")) {
        messageErreur = "Le message audio est trop volumineux. Veuillez enregistrer un message plus court.";
      } else if (error.message.includes("429") || error.message.includes("trop de requêtes")) {
        messageErreur = "Trop de requêtes. Veuillez réessayer dans quelques instants.";
      } else if (error.message.includes("401") || error.message.includes("403")) {
        messageErreur = "Problème d'authentification avec le service Claude. Veuillez vous reconnecter.";
      } else if (error.message.includes("Format") || error.message.includes("corrompu")) {
        messageErreur = "Le format audio n'est pas valide. Veuillez réessayer avec un autre enregistrement.";
      } else {
        messageErreur = error.message;
      }
    }
    
    throw new Error(messageErreur);
  }
}