// supabase/functions/whatsapp/webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Fonction de logging améliorée
const log = (level: string, message: string, data?: any) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data: data || null
  };
  console[level](JSON.stringify(entry));
};

Deno.serve(async (req) => {
  // Gestion des requêtes preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    log("info", "Traitement d'un webhook WhatsApp entrant (Meta API)");
    
    // Vérifier l'URL pour les défis de vérification
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    
    // Gestion de la vérification de webhook
    if (mode === "subscribe" && token) {
      const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
      
      if (token === verifyToken) {
        log("info", "Défi de vérification webhook réussi", { challenge });
        return new Response(challenge, { status: 200 });
      } else {
        log("error", "Échec de la vérification webhook - token invalide", { 
          receivedToken: token, 
          expectedToken: "(masqué)" 
        });
        return new Response("Unauthorized", { status: 403 });
      }
    }

    // Traitement des messages entrants
    const webhookData = await req.json();
    log("info", "Données webhook reçues", webhookData);
    
    // Pour l'API Meta, les données sont structurées différemment
    const entries = webhookData.entry || [];
    
    for (const entry of entries) {
      const changes = entry.changes || [];
      
      for (const change of changes) {
        if (change.field === "messages") {
          const value = change.value;
          
          if (!value || !value.messages || !value.messages.length) {
            log("warn", "Aucun message trouvé dans la notification", { value });
            continue;
          }
          
          // Parcourir tous les messages
          for (const message of value.messages) {
            const senderNumber = message.from;
            
            // Initialisation Supabase
            const supabaseClient = createClient(
              Deno.env.get("SUPABASE_URL") || "",
              Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
            );
            
            // Gérer les différents types de messages
            if (message.type === "audio") {
              const audioId = message.audio?.id;
              
              if (!audioId) {
                log("warn", "ID audio manquant", { message });
                continue;
              }
              
              log("info", "Message audio détecté", { audioId, senderNumber });
              
              try {
                // 1. Récupérer le fichier audio depuis l'API Media
                const mediaUrl = `https://graph.facebook.com/v18.0/${audioId}`;
                
                // D'abord, obtenir l'URL du média
                const mediaInfoResponse = await fetch(mediaUrl, {
                  headers: {
                    "Authorization": `Bearer ${Deno.env.get("WHATSAPP_ACCESS_TOKEN")}`
                  }
                });
                
                if (!mediaInfoResponse.ok) {
                  throw new Error(`Échec de la récupération des infos média: ${mediaInfoResponse.status}`);
                }
                
                const mediaInfo = await mediaInfoResponse.json();
                
                if (!mediaInfo.url) {
                  throw new Error("URL du média non disponible");
                }
                
                // Télécharger le contenu du média
                const downloadResponse = await fetch(mediaInfo.url, {
                  headers: {
                    "Authorization": `Bearer ${Deno.env.get("WHATSAPP_ACCESS_TOKEN")}`
                  }
                });
                
                if (!downloadResponse.ok) {
                  throw new Error(`Échec du téléchargement du média: ${downloadResponse.status}`);
                }
                
                // 2. Convertir en Base64
                const arrayBuffer = await downloadResponse.arrayBuffer();
                const base64Audio = btoa(
                  new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                );
                
                log("info", "Audio récupéré et converti en base64", { 
                  size: arrayBuffer.byteLength,
                  previewBase64: base64Audio.substring(0, 20) + '...' 
                });
                
                // 3. Appel à la fonction Claude
                const claudeResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/claude`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
                  },
                  body: JSON.stringify({
                    prompt: "",
                    phoneNumber: senderNumber,
                    generateAudio: true,
                    isAudioInput: true,
                    audioData: base64Audio,
                    mimeType: mediaInfo.mime_type || "audio/ogg"
                  })
                });
                
                if (!claudeResponse.ok) {
                  const errorText = await claudeResponse.text();
                  log("error", "Erreur lors de l'appel à Claude", { 
                    status: claudeResponse.status, 
                    response: errorText 
                  });
                  throw new Error(`Erreur Claude: ${claudeResponse.status} - ${errorText}`);
                }
                
                const claudeData = await claudeResponse.json();
                
                // 4. Envoi de la réponse à l'utilisateur via l'API WhatsApp
                const whatsappResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
                  },
                  body: JSON.stringify({
                    to: senderNumber,
                    message: claudeData.response
                  })
                });
                
                if (!whatsappResponse.ok) {
                  const errorText = await whatsappResponse.text();
                  log("error", "Erreur lors de l'envoi de la réponse", { 
                    status: whatsappResponse.status, 
                    response: errorText 
                  });
                }
                
              } catch (mediaError) {
                log("error", "Erreur lors du traitement du média audio", { 
                  error: mediaError instanceof Error ? mediaError.message : String(mediaError),
                  stack: mediaError instanceof Error ? mediaError.stack : null
                });
                
                // Envoyer un message d'erreur à l'utilisateur
                await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
                  },
                  body: JSON.stringify({
                    to: senderNumber,
                    message: "Désolé, je n'ai pas pu traiter votre message audio. Pourriez-vous réessayer ou envoyer un message texte?"
                  })
                });
              }
            } 
            // Traitement des messages texte
            else if (message.type === "text") {
              const messageBody = message.text?.body;
              
              if (!messageBody) {
                log("warn", "Corps du message texte manquant", { message });
                continue;
              }
              
              log("info", "Message texte détecté", { messageBody, senderNumber });
              
              // Traitement du message texte avec Claude
              try {
                const claudeResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/claude`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
                  },
                  body: JSON.stringify({
                    prompt: messageBody,
                    phoneNumber: senderNumber,
                    generateAudio: true
                  })
                });
                
                if (!claudeResponse.ok) {
                  const errorText = await claudeResponse.text();
                  log("error", "Erreur lors de l'appel à Claude", { 
                    status: claudeResponse.status, 
                    response: errorText 
                  });
                  throw new Error(`Erreur Claude: ${claudeResponse.status} - ${errorText}`);
                }
                
                const claudeData = await claudeResponse.json();
                
                // Envoi de la réponse
                const whatsappResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
                  },
                  body: JSON.stringify({
                    to: senderNumber,
                    message: claudeData.response
                  })
                });
                
                if (!whatsappResponse.ok) {
                  const errorText = await whatsappResponse.text();
                  log("error", "Erreur lors de l'envoi de la réponse", { 
                    status: whatsappResponse.status, 
                    response: errorText 
                  });
                }
              } catch (textError) {
                log("error", "Erreur lors du traitement du message texte", { 
                  error: textError instanceof Error ? textError.message : String(textError),
                  stack: textError instanceof Error ? textError.stack : null
                });
              }
            }
            // Autres types de messages (images, vidéos, etc.)
            else {
              log("info", "Type de message non géré", { 
                type: message.type, 
                senderNumber 
              });
              
              // Vous pouvez ajouter le traitement pour d'autres types de médias ici
            }
          }
        }
      }
    }
    
    // Réponse standard pour les webhooks Meta
    return new Response("EVENT_RECEIVED", { status: 200 });
    
  } catch (error) {
    log("error", "Erreur non gérée lors du traitement du webhook", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null
    });
    
    return new Response(
      JSON.stringify({ 
        error: "Erreur lors du traitement du webhook", 
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});