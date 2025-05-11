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
  try {
    // Vérification basique d'une chaîne base64 valide
    if (!data || data.length < 100) {
      console.warn("Données audio trop courtes ou vides");
      return false;
    }

    // Vérifier si c'est une chaîne base64 valide avec une expression régulière plus permissive
    const base64Regex = /^[A-Za-z0-9+/]*={0,3}$/;
    const isBase64Valid = base64Regex.test(data);
    
    if (!isBase64Valid) {
      console.warn("Format base64 invalide");
      return false;
    }

    // Vérification de la taille maximale (10MB)
    const estimatedSize = Math.ceil(data.length * 0.75); // Approximation de la taille en octets
    if (estimatedSize > 10 * 1024 * 1024) {
      console.warn("Fichier audio trop volumineux:", estimatedSize, "octets");
      return false;
    }

    return true;
  } catch (e) {
    console.error('Erreur lors de la validation audio:', e);
    return false;
  }
}

export async function generateResponse(
  prompt: string,
  options: GenerateResponseOptions
): Promise<GenerateResponseResult> {
  try {
    console.log("Génération d'une réponse Claude avec les paramètres:", {
      longuerPrompt: prompt.length, 
      estEntreeAudio: options.isAudioInput,
      audioPresent: !!options.audioData,
      audioTaille: options.audioData ? `${Math.floor(options.audioData.length / 1000)}KB` : 'N/A',
      genererAudio: options.generateAudio,
      typeVoix: options.voiceType
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
        throw new Error("Format audio non valide. Assurez-vous d'utiliser un format supporté (WebM, MP3 ou WAV)");
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
          throw new Error("Format de données audio non valide. Utilisez WebM, MP3 ou WAV.");
        case 413:
          throw new Error("Fichier audio trop volumineux (maximum 10MB)");
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
      } else if (error.message.includes("Format") || error.message.includes("non valide")) {
        messageErreur = "Format audio non supporté. Veuillez utiliser WebM, MP3 ou WAV.";
      } else {
        messageErreur = error.message;
      }
    }
    
    throw new Error(messageErreur);
  }
}