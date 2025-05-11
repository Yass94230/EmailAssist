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

export async function generateResponse(
  prompt: string,
  options: GenerateResponseOptions
): Promise<GenerateResponseResult> {
  try {
    // Ajout de logs pour le débogage
    console.log("Envoi de la requête à l'API Claude avec les options :", {
      longueurPrompt: prompt.length,
      estEntréeAudio: options.isAudioInput,
      contientAudio: !!options.audioData,
      generateAudio: options.generateAudio,
      voiceType: options.voiceType,
      phoneNumber: options.phoneNumber ? options.phoneNumber.substring(0, 4) + '****' : 'non défini'
    });

    // Validation des données avant l'envoi
    if (options.isAudioInput && (!options.audioData || options.audioData.length < 100)) {
      throw new Error("Les données audio sont invalides ou trop courtes");
    }

    // Préparation du corps de la requête
    const corpsRequête = {
      prompt,
      phoneNumber: options.phoneNumber,
      generateAudio: options.generateAudio || false,
      voiceType: options.voiceType || 'alloy',
      isAudioInput: options.isAudioInput || false,
      // S'assurer que les données audio sont correctement formatées
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

    // Gestion améliorée des erreurs pour les réponses non-200
    if (!response.ok) {
      const texteErreur = await response.text();
      let donnéesErreur;
      try {
        donnéesErreur = JSON.parse(texteErreur);
      } catch (e) {
        // Si ce n'est pas un JSON valide, utiliser le texte brut
        donnéesErreur = { error: texteErreur };
      }
      
      console.error("Réponse d'erreur de l'API Claude :", {
        statut: response.status,
        texteStatut: response.statusText,
        donnéesErreur
      });
      
      throw new Error(
        donnéesErreur?.error || donnéesErreur?.details || 
        `Erreur ${response.status}: ${response.statusText}`
      );
    }

    const données = await response.json();
    
    // Vérification de la structure de la réponse
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
    
    // Amélioration du message d'erreur
    let messageErreur = "Une erreur est survenue lors de la génération de la réponse";
    
    if (error instanceof Error) {
      if (error.message.includes("413") || error.message.includes("too large")) {
        messageErreur = "Le message audio est trop volumineux. Veuillez enregistrer un message plus court.";
      } else if (error.message.includes("429") || error.message.includes("too many requests")) {
        messageErreur = "Trop de requêtes. Veuillez réessayer dans quelques instants.";
      } else if (error.message.includes("401") || error.message.includes("403") || error.message.includes("unauthorized")) {
        messageErreur = "Problème d'authentification avec le service Claude. Veuillez vous reconnecter.";
      } else {
        messageErreur = error.message;
      }
    }
    
    throw new Error(messageErreur);
  }
}