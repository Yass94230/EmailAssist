// supabase/functions/whatsapp-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// En-têtes CORS pour permettre l'accès de n'importe quelle origine
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

// Utilitaire de journalisation
const log = (level: string, message: string, data?: any) => {
  console[level](`[WhatsApp Webhook] ${message}`, data ? JSON.stringify(data) : '');
};

log("info", "Fonction Webhook WhatsApp démarrée");

/**
 * Convertit un ArrayBuffer en chaîne Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  try {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    // Traitement par chunks pour éviter les dépassements de pile
    const chunkSize = 1024 * 10; // 10KB par chunk
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.slice(i, Math.min(i + chunkSize, len));
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j]);
      }
    }
    
    return btoa(binary);
  } catch (error) {
    log("error", "Erreur dans arrayBufferToBase64:", error);
    throw error;
  }
}

/**
 * Télécharge un média WhatsApp à partir de son ID
 */
async function downloadWhatsAppMedia(mediaId: string): Promise<ArrayBuffer> {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v17.0";
  
  if (!accessToken) {
    throw new Error("Token d'accès WhatsApp manquant");
  }
  
  try {
    log("info", `Récupération de l'URL du média ${mediaId}`);
    
    // Étape 1: Obtenir l'URL du média
    const mediaUrlResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${mediaId}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`
        }
      }
    );
    
    if (!mediaUrlResponse.ok) {
      const errorText = await mediaUrlResponse.text();
      log("error", "Erreur lors de la récupération de l'URL du média:", { 
        status: mediaUrlResponse.status, 
        error: errorText
      });
      throw new Error(`Erreur obtention URL média: ${mediaUrlResponse.status}`);
    }
    
    const mediaData = await mediaUrlResponse.json();
    log("info", "URL du média obtenue:", { url: mediaData.url?.substring(0, 50) + '...' });
    
    // Étape 2: Télécharger le média
    const mediaResponse = await fetch(mediaData.url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    
    if (!mediaResponse.ok) {
      log("error", "Erreur lors du téléchargement du média:", { 
        status: mediaResponse.status
      });
      throw new Error(`Erreur téléchargement média: ${mediaResponse.status}`);
    }
    
    const buffer = await mediaResponse.arrayBuffer();
    log("info", "Média téléchargé avec succès", { size: buffer.byteLength });
    
    return buffer;
  } catch (error) {
    log("error", "Erreur lors du téléchargement du média:", error);
    throw error;
  }
}

/**
 * Transcrit un message audio avec Claude
 */
async function transcribeAudio(audioBuffer: ArrayBuffer, mimeType: string = "audio/mp3"): Promise<string> {
  try {
    log("info", "Transcription d'un message audio", { size: audioBuffer.byteLength });
    
    const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!CLAUDE_API_KEY) {
      throw new Error("Clé API Claude manquante");
    }
    
    // Convertir en Base64
    const audioBase64 = arrayBufferToBase64(audioBuffer);
    
    log("info", "Envoi à Claude pour transcription");
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
                  media_type: mimeType,
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
      log("error", "Erreur API Claude pour la transcription:", { 
        status: transcriptionRes.status, 
        error: errorText
      });
      throw new Error(`Erreur transcription: ${transcriptionRes.status}`);
    }

    const data = await transcriptionRes.json();
    
    if (!data.content || !data.content[0]?.text) {
      throw new Error("Format de réponse de transcription invalide");
    }
    
    const transcribedText = data.content[0].text;
    log("info", "Transcription réussie", { text: transcribedText.substring(0, 100) + '...' });
    
    return transcribedText;
  } catch (error) {
    log("error", "Erreur lors de la transcription:", error);
    throw error;
  }
}

/**
 * Génère une réponse avec Claude
 */
async function generateResponse(input: string): Promise<string> {
  try {
    log("info", "Génération d'une réponse", { input: input.substring(0, 100) + '...' });
    
    const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!CLAUDE_API_KEY) {
      throw new Error("Clé API Claude manquante");
    }
    
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
        messages: [{ role: "user", content: input }],
      }),
    });

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      log("error", "Erreur API Claude pour la génération:", { errorText });
      throw new Error(`Erreur génération: ${textResponse.status}`);
    }

    const data = await textResponse.json();
    
    if (!data.content || !data.content[0]?.text) {
      throw new Error("Format de réponse invalide");
    }
    
    const response = data.content[0].text;
    log("info", "Réponse générée avec succès", { length: response.length });
    
    return response;
  } catch (error) {
    log("error", "Erreur lors de la génération de réponse:", error);
    throw error;
  }
}

/**
 * Envoie un message WhatsApp
 */
async function sendWhatsAppMessage(to: string, message: string): Promise<any> {
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v17.0";
  
  if (!phoneNumberId || !accessToken) {
    throw new Error("Configuration WhatsApp manquante");
  }
  
  // S'assurer que le numéro est au format correct (sans le +)
  const formattedTo = to.startsWith('+') ? to.substring(1) : to;
  
  try {
    log("info", `Envoi d'un message à ${formattedTo}`, { 
      messageLength: message.length 
    });
    
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedTo,
          type: "text",
          text: { 
            body: message
          }
        })
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      log("error", "Erreur API WhatsApp:", errorData);
      throw new Error(`Erreur envoi: ${response.status}`);
    }
    
    const data = await response.json();
    log("info", "Message envoyé avec succès", { 
      messageId: data.messages?.[0]?.id 
    });
    
    return data;
  } catch (error) {
    log("error", "Erreur lors de l'envoi du message:", error);
    throw error;
  }
}

// Fonction principale
serve(async (req) => {
  // Gestion des requêtes OPTIONS (CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Vérification du webhook (GET)
  if (req.method === "GET") {
    try {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      log("info", "Tentative de vérification du webhook", { mode, token });

      // Récupérer le token de vérification depuis les variables d'environnement
      const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

      if (!verifyToken) {
        log("error", "Token de vérification non configuré");
        return new Response("Webhook Verify Token not set", { 
          status: 500,
          headers: { ...corsHeaders }
        });
      }

      if (mode === "subscribe" && token === verifyToken) {
        log("info", "Webhook vérifié avec succès ✅");
        
        // Répondre avec le challenge pour valider le webhook
        return new Response(challenge, {
          status: 200,
          headers: { 
            "Content-Type": "text/plain",
            ...corsHeaders
          }
        });
      } else {
        log("error", "Échec de la vérification du webhook", { 
          expected: verifyToken,
          received: token
        });
        
        return new Response("Verification Failed", {
          status: 403,
          headers: { 
            "Content-Type": "text/plain",
            ...corsHeaders
          }
        });
      }
    } catch (error) {
      log("error", "Erreur lors de la vérification", error);
      
      return new Response("Verification Error", {
        status: 500,
        headers: { 
          "Content-Type": "text/plain",
          ...corsHeaders
        }
      });
    }
  }

  // Traitement des webhooks entrants (POST)
  if (req.method === "POST") {
    try {
      // Récupérer le corps de la requête
      const body = await req.text();
      log("info", "Données webhook reçues", { 
        bodyLength: body.length,
        preview: body.substring(0, 200) + (body.length > 200 ? "..." : "")
      });
      
      // Parser le JSON
      let data;
      try {
        data = JSON.parse(body);
      } catch (parseError) {
        log("error", "Erreur lors du parsing JSON", parseError);
        return new Response("JSON Parse Error", { 
          status: 400,
          headers: { ...corsHeaders }
        });
      }
      
      // Configuration Supabase
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (!supabaseUrl || !supabaseKey) {
        log("warn", "Configuration Supabase manquante");
      }
      
      const supabase = supabaseUrl && supabaseKey 
        ? createClient(supabaseUrl, supabaseKey)
        : null;
      
      // Traitement du webhook WhatsApp
      if (data.object === "whatsapp_business_account") {
        if (data.entry && data.entry.length > 0) {
          for (const entry of data.entry) {
            if (entry.changes && entry.changes.length > 0) {
              for (const change of entry.changes) {
                if (change.value && change.value.messages && change.value.messages.length > 0) {
                  // Traiter chaque message
                  for (const message of change.value.messages) {
                    try {
                      // Numéro de téléphone au format international avec +
                      const fromNumber = `+${message.from}`;
                      log("info", `Message reçu de ${fromNumber}`, { type: message.type });
                      
                      // Enregistrer le message dans Supabase si possible
                      if (supabase) {
                        try {
                          const { error: insertError } = await supabase
                            .from('whatsapp_messages')
                            .insert({
                              message_id: message.id,
                              from_number: fromNumber,
                              message_type: message.type,
                              timestamp: new Date().toISOString(),
                              raw_data: JSON.stringify(message)
                            });
                            
                          if (insertError) {
                            log("warn", "Erreur d'insertion en base de données", insertError);
                          }
                        } catch (dbError) {
                          log("warn", "Erreur lors de l'enregistrement du message", dbError);
                        }
                      }
                      
                      // Traitement selon le type de message
                      if (message.type === "text") {
                        // Message texte
                        const textContent = message.text.body;
                        log("info", "Message texte reçu", { text: textContent });
                        
                        // Générer une réponse
                        const response = await generateResponse(textContent);
                        
                        // Envoyer la réponse
                        await sendWhatsAppMessage(fromNumber, response);
                        
                      } else if (message.type === "audio") {
                        // Message audio
                        log("info", "Message audio reçu", { id: message.audio.id });
                        
                        // Télécharger le fichier audio
                        const audioBuffer = await downloadWhatsAppMedia(message.audio.id);
                        
                        // Transcription
                        const transcription = await transcribeAudio(audioBuffer);
                        
                        // Générer une réponse basée sur la transcription
                        const response = await generateResponse(transcription);
                        
                        // Envoyer la réponse
                        await sendWhatsAppMessage(fromNumber, response);
                      } else {
                        // Autres types de messages (images, vidéo, etc.)
                        log("info", `Message de type ${message.type} reçu`);
                        
                        // Envoyer une réponse générique
                        await sendWhatsAppMessage(
                          fromNumber, 
                          `J'ai bien reçu votre message de type ${message.type}. Comment puis-je vous aider ?`
                        );
                      }
                    } catch (messageError) {
                      log("error", "Erreur lors du traitement du message", messageError);
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // Retourner une réponse 200 OK pour confirmer la réception
      return new Response("EVENT_RECEIVED", {
        status: 200,
        headers: { 
          "Content-Type": "text/plain",
          ...corsHeaders
        }
      });
    } catch (error) {
      log("error", "Erreur lors du traitement du webhook", error);
      
      // Retourner une réponse 200 OK même en cas d'erreur pour éviter les réenvois
      return new Response("EVENT_RECEIVED", {
        status: 200,
        headers: { 
          "Content-Type": "text/plain",
          ...corsHeaders
        }
      });
    }
  }

  // Méthode non supportée
  return new Response(`Method ${req.method} Not Allowed`, {
    status: 405,
    headers: { 
      "Content-Type": "text/plain",
      ...corsHeaders
    }
  });
});