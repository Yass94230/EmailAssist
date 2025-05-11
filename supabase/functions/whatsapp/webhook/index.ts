// whatsapp-webhook.ts - Version améliorée pour le traitement audio bidirectionnel
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

console.info('WhatsApp Webhook function started');

/**
 * Convertit un ArrayBuffer en chaîne Base64 sans utiliser Buffer.from
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  try {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    // Écrire le contenu binaire en évitant les dépassements de pile
    // pour les gros fichiers
    const chunkSize = 1024 * 10; // 10KB par chunk
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.slice(i, Math.min(i + chunkSize, len));
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j]);
      }
    }
    
    return btoa(binary);
  } catch (error) {
    console.error("Erreur dans arrayBufferToBase64:", error);
    if (error instanceof RangeError) {
      console.error("Dépassement de pile, taille du buffer trop importante:", buffer.byteLength);
    }
    throw error;
  }
}

/**
 * Convertit une chaîne Base64 en Blob sans utiliser Buffer.from
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  try {
    const cleanBase64 = base64.replace(/^data:.*,/, '');
    const binaryString = atob(cleanBase64);
    const length = binaryString.length;
    
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: mimeType });
  } catch (error) {
    console.error('Erreur dans base64ToBlob:', error);
    return new Blob([], { type: mimeType });
  }
}

/**
 * Vérifie si la reconnaissance vocale est activée pour un utilisateur
 */
async function isVoiceRecognitionEnabled(phoneNumber: string, supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('voice_recognition_enabled')
      .eq('phone_number', phoneNumber)
      .maybeSingle();
    
    if (error) {
      console.error("Erreur lors de la vérification des paramètres audio:", error);
      // Par défaut, activer la reconnaissance vocale si une erreur se produit
      return true;
    }
    
    // Si aucun paramètre n'est trouvé ou si voice_recognition_enabled est null, activer par défaut
    if (!data) return true;
    
    return data.voice_recognition_enabled ?? true;
  } catch (error) {
    console.error("Erreur lors de la vérification de la reconnaissance vocale:", error);
    // Par défaut, activer la reconnaissance vocale
    return true;
  }
}

/**
 * Vérifie si les réponses audio sont activées pour un utilisateur et récupère le type de voix
 */
async function getAudioSettings(phoneNumber: string, supabase: any): Promise<{ audioEnabled: boolean; voiceType: string }> {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('audio_enabled, voice_type')
      .eq('phone_number', phoneNumber)
      .maybeSingle();
    
    if (error) {
      console.error("Erreur lors de la vérification des paramètres audio:", error);
      // Par défaut, activer l'audio avec voix Alloy
      return { audioEnabled: true, voiceType: 'alloy' };
    }
    
    // Si aucun paramètre n'est trouvé, activer par défaut
    if (!data) return { audioEnabled: true, voiceType: 'alloy' };
    
    return { 
      audioEnabled: data.audio_enabled ?? true, 
      voiceType: data.voice_type || 'alloy' 
    };
  } catch (error) {
    console.error("Erreur lors de la vérification des paramètres audio:", error);
    // Par défaut, activer l'audio avec voix Alloy
    return { audioEnabled: true, voiceType: 'alloy' };
  }
}

// Fonction pour transcrire un message vocal avec Claude
async function transcribeVoiceMessage(mediaUrl: string): Promise<string> {
  try {
    console.log("Début de la transcription du message vocal:", mediaUrl);
    const audioResponse = await fetch(mediaUrl);
    if (!audioResponse.ok) {
      throw new Error(`Impossible de récupérer le fichier audio (${audioResponse.status}): ${audioResponse.statusText}`);
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    console.log(`Fichier audio récupéré, taille: ${audioBuffer.byteLength} octets`);
    
    // Utiliser l'API Claude pour la transcription
    const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!CLAUDE_API_KEY) {
      throw new Error('Clé API Claude manquante');
    }

    // Convertir l'ArrayBuffer en Base64
    const audioBase64 = arrayBufferToBase64(audioBuffer);
    
    // Vérifier la taille des données base64 avant l'envoi
    console.log(`Audio converti en Base64, taille: ${audioBase64.length} caractères`);
    
    // Déterminer le type MIME en fonction de l'URL ou du contenu
    let mediaType = "audio/mp3";
    if (mediaUrl.includes(".ogg") || mediaUrl.includes(".oga")) {
      mediaType = "audio/ogg";
    } else if (mediaUrl.includes(".wav")) {
      mediaType = "audio/wav";
    } else if (mediaUrl.includes(".webm")) {
      mediaType = "audio/webm";
    }
    
    console.log("Type MIME détecté:", mediaType);
    console.log("Envoi à Claude pour transcription...");

    const transcriptionRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "audio",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: audioBase64
                }
              }
            ]
          }
        ]
      })
    });

    if (!transcriptionRes.ok) {
      const errorText = await transcriptionRes.text();
      console.error("Erreur de l'API Claude:", errorText);
      
      // Tenter de parser l'erreur pour avoir plus de détails
      try {
        const errorData = JSON.parse(errorText);
        const errorType = errorData.error?.type || "unknown";
        const errorMessage = errorData.error?.message || "Erreur inconnue";
        
        throw new Error(`Erreur de transcription (${errorType}): ${errorMessage}`);
      } catch (parseError) {
        throw new Error(`Erreur lors de la transcription: ${transcriptionRes.status} - ${errorText.substring(0, 100)}`);
      }
    }

    const transcriptionData = await transcriptionRes.json();
    if (!transcriptionData.content || !transcriptionData.content[0]?.text) {
      throw new Error("Format de réponse de transcription invalide");
    }
    
    const transcribedText = transcriptionData.content[0].text;
    console.log("Transcription réussie:", transcribedText);
    
    return transcribedText;
  } catch (error) {
    console.error('Erreur détaillée lors de la transcription:', error);
    throw error;
  }
}

// Fonction pour obtenir une réponse de Claude avec génération audio optionnelle
async function getClaudeResponse(prompt: string, generateAudio: boolean, voiceType: string = 'alloy'): Promise<{ text: string; audio?: string }> {
  try {
    console.log("Génération d'une réponse Claude", { generateAudio, voiceType });
    
    const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!CLAUDE_API_KEY) {
      throw new Error('Clé API Claude manquante');
    }

    // Obtenir une réponse textuelle de Claude
    const textResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
        max_tokens: 1000,
        temperature: 0.7,
        system: "Tu es un assistant email professionnel qui aide à gérer les emails et à rédiger des réponses appropriées. Tu communiques exclusivement en français.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      throw new Error(`Erreur API Claude: ${errorText}`);
    }

    const responseData = await textResponse.json();
    
    if (!responseData.content || !Array.isArray(responseData.content) || !responseData.content[0]?.text) {
      throw new Error("Format de réponse invalide");
    }

    const response = responseData.content[0].text;
    console.log("Réponse textuelle générée");

    // Si la génération audio n'est pas demandée, retourner uniquement le texte
    if (!generateAudio) {
      return { text: response };
    }

    // Générer l'audio de la réponse
    console.log("Génération de l'audio avec la voix:", voiceType);
    const speechRes = await fetch("https://api.anthropic.com/v1/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
        input: response,
        voice: voiceType,
        format: "mp3",
      }),
    });

    if (!speechRes.ok) {
      console.error("Erreur lors de la génération audio:", await speechRes.text());
      // En cas d'échec de la génération audio, retourner uniquement le texte
      return { text: response };
    }

    const audioBuffer = await speechRes.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioBuffer);
    console.log("Audio généré avec succès");

    return {
      text: response,
      audio: audioBase64
    };
  } catch (error) {
    console.error("Erreur lors de la génération de la réponse Claude:", error);
    throw error;
  }
}

// Fonction pour envoyer un message WhatsApp avec audio optionnel
async function sendWhatsAppMessage(to: string, text: string, audioData?: string) {
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

  if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
    throw new Error("Configuration Twilio manquante");
  }

  try {
    console.log("Envoi d'un message WhatsApp à:", to, { hasAudio: !!audioData });
    
    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const formData = new FormData();
    
    formData.append('To', `whatsapp:${to}`);
    formData.append('From', `whatsapp:${twilioWhatsAppNumber}`);
    formData.append('Body', text);

    // Si un audio est fourni, l'ajouter comme pièce jointe
    if (audioData) {
      // Créer un blob temporaire à partir des données base64
      const audioBlob = base64ToBlob(audioData, 'audio/mp3');
      
      // Dans Twilio, MediaUrl doit être une URL accessible publiquement
      // Pour les tests, on peut utiliser un service temporaire de stockage
      // Dans un environnement de production, il faudrait stocker le fichier sur un CDN ou un service de stockage
      
      // Ici, nous allons créer une URL de média à partir du blob
      // Note: ceci est une simplification, vous devrez adapter selon votre infrastructure réelle
      const audioUrl = 'https://example.com/audio.mp3'; // URL factice pour cet exemple
      formData.append('MediaUrl', audioUrl);
    }

    const twilioResponse = await fetch(twilioEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
      },
      body: formData,
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      throw new Error(`Erreur Twilio: ${errorText}`);
    }

    const data = await twilioResponse.json();
    console.log("Message WhatsApp envoyé avec succès, SID:", data.sid);
    
    return data;
  } catch (error) {
    console.error("Erreur lors de l'envoi du message WhatsApp:", error);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    console.log("Requête reçue sur:", url.pathname);

    // Configuration Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuration Supabase manquante");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Traitement des webhooks Twilio WhatsApp
    const formData = await req.formData();
    const messageBody = formData.get('Body') || '';
    const mediaContentType = formData.get('MediaContentType0') || '';
    const mediaUrl = formData.get('MediaUrl0') || '';
    
    // Numéro de téléphone de l'expéditeur
    const from = (formData.get('From') || '')
      .toString()
      .replace('whatsapp:', '')
      .trim();
    
    if (!from) {
      throw new Error("Numéro d'expéditeur manquant");
    }
    
    console.log("Message reçu de:", from, {
      hasBody: !!messageBody,
      hasMedia: !!mediaUrl,
      mediaType: mediaContentType || 'none'
    });
    
    // Vérifier si la reconnaissance vocale est activée pour cet utilisateur
    const voiceRecognitionEnabled = await isVoiceRecognitionEnabled(from, supabase);
    
    // Vérifier les préférences audio (réponses audio activées, type de voix)
    const { audioEnabled, voiceType } = await getAudioSettings(from, supabase);
    
    let responseText = '';
    
    // Traitement d'un message audio
    if (mediaUrl && mediaContentType?.toString().includes('audio') && voiceRecognitionEnabled) {
      try {
        console.log("Transcription d'un message audio...");
        const transcribedText = await transcribeVoiceMessage(mediaUrl.toString());
        
        // Obtenir une réponse basée sur la transcription
        const claudeResponse = await getClaudeResponse(
          transcribedText,
          audioEnabled,
          voiceType
        );
        
        // Envoyer la réponse (texte et audio si activé)
        await sendWhatsAppMessage(
          from,
          claudeResponse.text,
          claudeResponse.audio
        );
        
        responseText = "Message audio traité avec succès";
        
      } catch (error) {
        console.error("Erreur lors du traitement du message audio:", error);
        
        // Envoyer un message d'erreur à l'utilisateur
        await sendWhatsAppMessage(
          from,
          "Désolé, je n'ai pas pu traiter votre message vocal. Veuillez réessayer ou envoyer un message texte."
        );
        
        responseText = "Erreur lors du traitement du message audio";
      }
    } 
    // Traitement d'un message texte
    else if (messageBody) {
      try {
        console.log("Traitement d'un message texte:", messageBody.toString().substring(0, 50) + '...');
        
        // Obtenir une réponse à partir du texte
        const claudeResponse = await getClaudeResponse(
          messageBody.toString(),
          audioEnabled,
          voiceType
        );
        
        // Envoyer la réponse (texte et audio si activé)
        await sendWhatsAppMessage(
          from,
          claudeResponse.text,
          claudeResponse.audio
        );
        
        responseText = "Message texte traité avec succès";
        
      } catch (error) {
        console.error("Erreur lors du traitement du message texte:", error);
        
        // Envoyer un message d'erreur à l'utilisateur
        await sendWhatsAppMessage(
          from,
          "Désolé, je n'ai pas pu traiter votre message. Veuillez réessayer."
        );
        
        responseText = "Erreur lors du traitement du message texte";
      }
    } else {
      // Aucun contenu exploitable
      console.log("Message sans contenu exploitable");
      
      await sendWhatsAppMessage(
        from,
        "Désolé, je n'ai reçu aucun contenu exploitable. Veuillez envoyer un message texte ou vocal."
      );
      
      responseText = "Message sans contenu exploitable";
    }
    
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        headers: {
          "Content-Type": "text/xml",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Erreur de traitement du webhook:", error);
    
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Une erreur est survenue</Message></Response>`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/xml",
          ...corsHeaders,
        },
      }
    );
  }
});