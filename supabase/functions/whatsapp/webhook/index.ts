// whatsapp-webhook.ts - Version corrigée pour éviter les erreurs "from is not a function"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const wsClients = new Set();

console.info('WhatsApp Webhook function started');

/**
 * Convertit un ArrayBuffer en chaîne Base64 sans utiliser Buffer.from
 * Cette version fonctionne dans Deno et évite les erreurs "from is not a function"
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

// Fonction pour transcrire un message vocal
async function transcribeVoiceMessage(mediaUrl: string): Promise<string> {
  try {
    const audioResponse = await fetch(mediaUrl);
    if (!audioResponse.ok) {
      throw new Error('Impossible de récupérer le fichier audio');
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    
    // Utiliser l'API Claude pour la transcription
    const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!CLAUDE_API_KEY) {
      throw new Error('Clé API Claude manquante');
    }

    // Convertir l'ArrayBuffer en Base64 sans utiliser Buffer.from
    const audioBase64 = arrayBufferToBase64(audioBuffer);

    const transcriptionRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
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
      throw new Error('Erreur lors de la transcription');
    }

    const transcriptionData = await transcriptionRes.json();
    return transcriptionData.content[0].text;
  } catch (error) {
    console.error('Erreur lors de la transcription:', error);
    throw error;
  }
}

// Fonction pour envoyer un message WhatsApp avec audio
async function sendWhatsAppMessage(to: string, text: string, audioBase64?: string) {
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

  if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
    throw new Error("Configuration Twilio manquante");
  }

  const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
  const formData = new FormData();
  
  formData.append('To', `whatsapp:${to}`);
  formData.append('From', `whatsapp:${twilioWhatsAppNumber}`);
  formData.append('Body', text);

  // Si un audio est fourni, l'ajouter comme pièce jointe
  if (audioBase64) {
    // Utiliser la fonction sécurisée au lieu de Buffer.from
    const audioBlob = base64ToBlob(audioBase64, 'audio/mp3');
    formData.append('MediaUrl', audioBlob, 'message.mp3');
  }

  const response = await fetch(twilioEndpoint, {
    method: "POST",
    headers: {
      // Utiliser le fonction btoa native pour l'encodage Base64
      "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Erreur Twilio: ${errorData.message}`);
  }

  return response.json();
}

// Le traitement principal de la requête
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuration Supabase manquante");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const from = formData.get('From')?.toString();
    const mediaUrl = formData.get('MediaUrl0')?.toString();
    let messageBody = formData.get('Body')?.toString() || '';
    
    // Transcription si message vocal
    if (mediaUrl && formData.get('MediaContentType0')?.toString().startsWith('audio/')) {
      try {
        messageBody = await transcribeVoiceMessage(mediaUrl);
        console.log('Message vocal transcrit:', messageBody);
      } catch (error) {
        console.error('Erreur de transcription:', error);
        throw error;
      }
    }

    if (!messageBody || !from) {
      throw new Error("Données manquantes");
    }

    const phoneNumber = from.replace('whatsapp:', '');
    
    // Générer la réponse avec audio via Claude
    const claudeResponse = await fetch(`${supabaseUrl}/functions/v1/claude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        prompt: messageBody,
        generateAudio: true
      })
    });

    if (!claudeResponse.ok) {
      throw new Error('Erreur lors de la génération de la réponse');
    }

    const { response: textResponse, audio: audioResponse } = await claudeResponse.json();

    // Envoyer la réponse avec l'audio si disponible
    await sendWhatsAppMessage(phoneNumber, textResponse, audioResponse);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Message traité et réponse envoyée",
        hasAudio: !!audioResponse
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Server error", 
        details: error instanceof Error ? error.message : String(error) 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});