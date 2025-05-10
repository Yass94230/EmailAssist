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
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binary);
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
    console.log("Début de la transcription du message vocal");
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
    console.log("Audio converti en Base64, envoi à Claude pour transcription");

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
                  media_type: "audio/mp3",
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
      throw new Error(`Erreur lors de la transcription: ${transcriptionRes.status}`);
    }

    const transcriptionData = await transcriptionRes.json();
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
      
      console.log("Ajout d'un fichier audio au message WhatsApp");
    }

    const response = await fetch(twilioEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erreur Twilio: ${errorData.message || response.statusText}`);
    }

    const responseData = await response.json();
    console.log("Message WhatsApp envoyé, SID:", responseData.sid);
    
    return responseData;
  } catch (error) {
    console.error("Erreur lors de l'envoi du message WhatsApp:", error);
    throw error;
  }
}

// Le traitement principal de la requête
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log("Réception d'une requête webhook WhatsApp");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuration Supabase manquante");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Analyser les données du formulaire Twilio
    const formData = await req.formData();
    const from = formData.get('From')?.toString();
    const mediaUrl = formData.get('MediaUrl0')?.toString();
    const mediaContentType = formData.get('MediaContentType0')?.toString();
    let messageBody = formData.get('Body')?.toString() || '';
    
    if (!from) {
      throw new Error("Expéditeur (From) manquant dans la requête");
    }
    
    const phoneNumber = from.replace('whatsapp:', '');
    console.log("Message reçu de:", phoneNumber, {
      hasMedia: !!mediaUrl,
      mediaType: mediaContentType || 'none',
      messageLength: messageBody.length
    });
    
    // Vérifier les paramètres audio de l'utilisateur
    const voiceRecognitionEnabled = await isVoiceRecognitionEnabled(phoneNumber, supabase);
    const { audioEnabled, voiceType } = await getAudioSettings(phoneNumber, supabase);
    
    console.log("Paramètres utilisateur:", {
      voiceRecognitionEnabled,
      audioEnabled,
      voiceType
    });
    
    // Transcription si message vocal et si la reconnaissance vocale est activée
    if (mediaUrl && mediaContentType?.startsWith('audio/') && voiceRecognitionEnabled) {
      try {
        console.log("Transcription du message vocal...");
        messageBody = await transcribeVoiceMessage(mediaUrl);
        console.log("Message vocal transcrit:", messageBody);
      } catch (error) {
        console.error('Erreur lors de la transcription:', error);
        return new Response(
          JSON.stringify({ 
            error: "Erreur lors de la transcription du message vocal",
            details: error instanceof Error ? error.message : String(error)
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }
    
    if (!messageBody) {
      console.log("Aucun message à traiter");
      return new Response(
        JSON.stringify({ 
          message: "Aucun message à traiter" 
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    // Générer la réponse avec Claude
    console.log("Génération de la réponse Claude...");
    const claudeResponse = await getClaudeResponse(messageBody, audioEnabled, voiceType);
    
    // Envoyer la réponse à l'utilisateur
    await sendWhatsAppMessage(phoneNumber, claudeResponse.text, claudeResponse.audio);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Message traité et réponse envoyée",
        hasAudio: !!claudeResponse.audio
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Erreur webhook:", error);
    return new Response(
      JSON.stringify({ 
        error: "Erreur serveur", 
        details: error instanceof Error ? error.message : String(error) 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});