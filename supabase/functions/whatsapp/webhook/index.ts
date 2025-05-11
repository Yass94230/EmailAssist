import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Fonction améliorée pour détecter le type MIME
function detectMimeType(mediaUrl: string, contentType?: string): string {
  // Si le type de contenu est fourni, l'utiliser
  if (contentType?.startsWith('audio/')) {
    return contentType;
  }

  // Sinon, détecter à partir de l'URL
  if (mediaUrl.includes('.ogg') || mediaUrl.includes('.oga')) {
    return 'audio/ogg';
  } else if (mediaUrl.includes('.mp3')) {
    return 'audio/mpeg';
  } else if (mediaUrl.includes('.wav')) {
    return 'audio/wav';
  } else if (mediaUrl.includes('.m4a')) {
    return 'audio/mp4';
  }

  // Par défaut pour WhatsApp
  return 'audio/ogg';
}

// Fonction pour télécharger et convertir l'audio
async function downloadAudio(mediaUrl: string, authToken: string): Promise<ArrayBuffer> {
  const response = await fetch(mediaUrl, {
    headers: {
      'Authorization': `Basic ${authToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Erreur lors du téléchargement de l'audio: ${response.status}`);
  }

  return await response.arrayBuffer();
}

// Fonction pour convertir ArrayBuffer en base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 1024 * 10; // 10KB chunks pour éviter les dépassements de pile
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  
  return btoa(binary);
}

serve(async (req) => {
  // Gestion des requêtes OPTIONS pour CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Récupération des identifiants Twilio
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!accountSid || !authToken || !apiKey) {
      throw new Error("Configuration manquante");
    }

    // Parse du formulaire Twilio
    const formData = await req.formData();
    
    // Extraction des données du message
    const from = formData.get("From")?.toString().replace("whatsapp:", "") || "";
    const body = formData.get("Body")?.toString() || "";
    const mediaUrl = formData.get("MediaUrl0")?.toString();
    const mediaContentType = formData.get("MediaContentType0")?.toString();

    console.log("Message reçu:", {
      from,
      hasBody: !!body,
      mediaUrl,
      mediaContentType
    });

    // Vérification du numéro d'expéditeur
    if (!from) {
      throw new Error("Numéro d'expéditeur manquant");
    }

    // Traitement du message audio
    if (mediaUrl && mediaContentType?.startsWith('audio/')) {
      try {
        console.log("Traitement d'un message audio");
        
        // Téléchargement de l'audio
        const audioBuffer = await downloadAudio(
          mediaUrl, 
          btoa(`${accountSid}:${authToken}`)
        );
        
        // Conversion en base64
        const audioBase64 = arrayBufferToBase64(audioBuffer);
        
        // Détection du type MIME
        const mimeType = detectMimeType(mediaUrl, mediaContentType);
        console.log("Type MIME détecté:", mimeType);

        // Transcription avec Claude
        const transcriptionResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-opus-20240229",
            max_tokens: 1000,
            messages: [{
              role: "user",
              content: [{
                type: "audio",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: audioBase64
                }
              }]
            }]
          })
        });

        if (!transcriptionResponse.ok) {
          throw new Error(`Erreur de transcription: ${transcriptionResponse.status}`);
        }

        const transcriptionData = await transcriptionResponse.json();
        const transcribedText = transcriptionData.content[0].text;

        // Envoi de la réponse via Twilio
        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
              To: `whatsapp:${from}`,
              From: `whatsapp:${Deno.env.get("TWILIO_PHONE_NUMBER")}`,
              Body: transcribedText
            })
          }
        );

        if (!twilioResponse.ok) {
          throw new Error(`Erreur Twilio: ${twilioResponse.status}`);
        }

        // Réponse au webhook
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            headers: {
              "Content-Type": "text/xml",
              ...corsHeaders
            }
          }
        );

      } catch (error) {
        console.error("Erreur lors du traitement audio:", error);
        
        // Envoi d'un message d'erreur à l'utilisateur
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
              To: `whatsapp:${from}`,
              From: `whatsapp:${Deno.env.get("TWILIO_PHONE_NUMBER")}`,
              Body: "Désolé, je n'ai pas pu traiter votre message audio. Veuillez réessayer ou envoyer un message texte."
            })
          }
        );

        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            headers: {
              "Content-Type": "text/xml",
              ...corsHeaders
            }
          }
        );
      }
    }
    
    // Traitement des messages texte
    else if (body) {
      try {
        // Obtenir une réponse de Claude
        const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-opus-20240229",
            max_tokens: 1000,
            messages: [{
              role: "user",
              content: body
            }]
          })
        });

        if (!claudeResponse.ok) {
          throw new Error(`Erreur Claude: ${claudeResponse.status}`);
        }

        const responseData = await claudeResponse.json();
        const responseText = responseData.content[0].text;

        // Envoi de la réponse via Twilio
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
              To: `whatsapp:${from}`,
              From: `whatsapp:${Deno.env.get("TWILIO_PHONE_NUMBER")}`,
              Body: responseText
            })
          }
        );

        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            headers: {
              "Content-Type": "text/xml",
              ...corsHeaders
            }
          }
        );

      } catch (error) {
        console.error("Erreur lors du traitement du message texte:", error);
        
        // Envoi d'un message d'erreur
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
              To: `whatsapp:${from}`,
              From: `whatsapp:${Deno.env.get("TWILIO_PHONE_NUMBER")}`,
              Body: "Désolé, une erreur s'est produite. Veuillez réessayer."
            })
          }
        );

        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            headers: {
              "Content-Type": "text/xml",
              ...corsHeaders
            }
          }
        );
      }
    }

    // Aucun contenu à traiter
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: {
          "Content-Type": "text/xml",
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error("Erreur générale:", error);
    
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 500,
        headers: {
          "Content-Type": "text/xml",
          ...corsHeaders
        }
      }
    );
  }
});