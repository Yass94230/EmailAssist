// supabase/functions/whatsapp/webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-hub-signature-256",
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

// Vérification des variables d'environnement requises
function checkRequiredEnvVars() {
  const required = [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_VERIFY_TOKEN",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY"
  ];
  
  const missing = required.filter(name => !Deno.env.get(name));
  
  if (missing.length > 0) {
    log("error", "Variables d'environnement requises manquantes", { missing });
    return false;
  }
  
  return true;
}

// Fonction améliorée et sécurisée pour convertir ArrayBuffer en Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    // Pour les très grands fichiers, utiliser une approche par chunks
    const chunkSize = 8192; // 8KB chunks
    let binary = '';
    
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.slice(i, Math.min(i + chunkSize, len));
      binary += Array.from(chunk).map(byte => String.fromCharCode(byte)).join('');
    }
    
    return btoa(binary);
  } catch (error) {
    log("error", "Erreur lors de la conversion ArrayBuffer vers Base64", {
      error: error instanceof Error ? error.message : String(error),
      bufferSize: buffer.byteLength
    });
    throw new Error("Échec de la conversion en Base64: " + (error instanceof Error ? error.message : String(error)));
  }
}

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
    
    // Vérification des variables d'environnement
    if (!checkRequiredEnvVars()) {
      return new Response(
        JSON.stringify({ error: "Configuration incomplète du serveur" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    // Vérifier signature du webhook si présente
    const signature = req.headers.get('x-hub-signature-256');
    if (signature) {
      // Note: Implémentation facultative de vérification de signature
      log("info", "Signature webhook reçue", { signature });
    }
    
    // Vérifier l'URL pour les défis de vérification (nécessaire pour Meta)
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
          
          // Initialisation Supabase une seule fois pour tous les messages
          const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") || "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
          );
          
          // Parcourir tous les messages
          for (const message of value.messages) {
            const senderNumber = message.from;
            const messageId = message.id || `unknown-${Date.now()}`;
            
            log("info", "Traitement du message", { 
              senderNumber, 
              messageId, 
              messageType: message.type
            });
            
            // Gérer les différents types de messages
            if (message.type === "audio") {
              const audioId = message.audio?.id;
              
              if (!audioId) {
                log("warn", "ID audio manquant", { message });
                continue;
              }
              
              log("info", "Message audio détecté", { audioId, senderNumber, messageId });
              
              try {
                // 1. Récupérer le fichier audio depuis l'API Media
                const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v18.0";
                const mediaUrl = `https://graph.facebook.com/${apiVersion}/${audioId}`;
                
                log("info", "Récupération des informations du média", { mediaUrl });
                
                // D'abord, obtenir l'URL du média
                const mediaInfoResponse = await fetch(mediaUrl, {
                  headers: {
                    "Authorization": `Bearer ${Deno.env.get("WHATSAPP_ACCESS_TOKEN")}`
                  }
                });
                
                if (!mediaInfoResponse.ok) {
                  const errorText = await mediaInfoResponse.text();
                  log("error", "Échec de la récupération des infos média", {
                    status: mediaInfoResponse.status, 
                    response: errorText
                  });
                  
                  throw new Error(`Échec de la récupération des infos média: ${mediaInfoResponse.status} - ${errorText}`);
                }
                
                const mediaInfo = await mediaInfoResponse.json();
                log("info", "Informations média récupérées", {
                  mediaId: audioId,
                  mimeType: mediaInfo.mime_type || "non spécifié",
                  hasUrl: !!mediaInfo.url
                });
                
                if (!mediaInfo.url) {
                  throw new Error("URL du média non disponible");
                }
                
                // Télécharger le contenu du média
                log("info", "Téléchargement du contenu audio");
                const downloadResponse = await fetch(mediaInfo.url, {
                  headers: {
                    "Authorization": `Bearer ${Deno.env.get("WHATSAPP_ACCESS_TOKEN")}`
                  }
                });
                
                if (!downloadResponse.ok) {
                  const errorText = await downloadResponse.text();
                  log("error", "Échec du téléchargement du média", {
                    status: downloadResponse.status, 
                    response: errorText.substring(0, 200)
                  });
                  
                  throw new Error(`Échec du téléchargement du média: ${downloadResponse.status} - ${errorText.substring(0, 200)}`);
                }
                
                // 2. Récupérer les données binaires
                const arrayBuffer = await downloadResponse.arrayBuffer();
                
                // Vérification de la taille du fichier
                if (arrayBuffer.byteLength > 10 * 1024 * 1024) { // 10MB
                  const sizeMB = (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2);
                  log("warn", "Fichier audio trop grand", { sizeMB });
                  throw new Error(`Le fichier audio est trop volumineux (${sizeMB}MB, maximum 10MB)`);
                }
                
                log("info", "Audio téléchargé avec succès", { 
                  sizeBytes: arrayBuffer.byteLength,
                  sizeMB: (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)
                });
                
                // 3. Convertir en Base64 avec la fonction améliorée
                const base64Audio = arrayBufferToBase64(arrayBuffer);
                
                log("info", "Audio converti en base64", { 
                  base64Length: base64Audio.length,
                  previewBase64: base64Audio.substring(0, 20) + '...',
                  isBase64Valid: base64Audio.length > 100
                });
                
                // Déterminer le type MIME correct
                const mimeType = mediaInfo.mime_type || 
                                message.audio?.mime_type || 
                                "audio/ogg"; // Fallback par défaut
                
                // 4. Préparation de l'appel à Claude
                log("info", "Préparation de l'envoi à Claude", { 
                  audioSize: base64Audio.length,
                  mimeType: mimeType,
                  isAudioValid: base64Audio.length > 100,
                  phoneNumber: senderNumber
                });
                
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
                    mimeType: mimeType
                  })
                });
                
                // 5. Gestion de la réponse Claude
                if (!claudeResponse.ok) {
                  const errorText = await claudeResponse.text();
                  log("error", "Erreur lors de l'appel à Claude", { 
                    status: claudeResponse.status, 
                    response: errorText
                  });
                  throw new Error(`Erreur Claude: ${claudeResponse.status} - ${errorText}`);
                }
                
                const claudeData = await claudeResponse.json();
                log("info", "Réponse Claude reçue avec succès", {
                  responseLength: claudeData.response.length,
                  hasAudio: !!claudeData.audio,
                  previewResponse: claudeData.response.substring(0, 50) + "..."
                });
                
                // 6. Envoi de la réponse à l'utilisateur via l'API WhatsApp
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
                  throw new Error(`Erreur d'envoi WhatsApp: ${whatsappResponse.status} - ${errorText}`);
                }
                
                log("info", "Réponse envoyée avec succès à l'utilisateur", { 
                  senderNumber,
                  messageId
                });
                
              } catch (mediaError) {
                log("error", "Erreur lors du traitement du média audio", { 
                  error: mediaError instanceof Error ? mediaError.message : String(mediaError),
                  stack: mediaError instanceof Error ? mediaError.stack : null,
                  senderNumber,
                  messageId
                });
                
                // Envoyer un message d'erreur à l'utilisateur
                try {
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
                  log("info", "Message d'erreur envoyé à l'utilisateur", { senderNumber });
                } catch (notifyError) {
                  log("error", "Échec de l'envoi du message d'erreur", {
                    error: notifyError instanceof Error ? notifyError.message : String(notifyError)
                  });
                }
              }
            } 
            // Traitement des messages texte
            else if (message.type === "text") {
              const messageBody = message.text?.body;
              
              if (!messageBody) {
                log("warn", "Corps du message texte manquant", { message });
                continue;
              }
              
              log("info", "Message texte détecté", { 
                messageBody, 
                senderNumber,
                messageId,
                textLength: messageBody.length
              });
              
              // Traitement du message texte avec Claude
              try {
                log("info", "Envoi du message texte à Claude");
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
                  log("error", "Erreur lors de l'appel à Claude pour le texte", { 
                    status: claudeResponse.status, 
                    response: errorText
                  });
                  throw new Error(`Erreur Claude: ${claudeResponse.status} - ${errorText}`);
                }
                
                const claudeData = await claudeResponse.json();
                log("info", "Réponse Claude reçue pour le message texte", {
                  responseLength: claudeData.response.length,
                  hasAudio: !!claudeData.audio
                });
                
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
                  log("error", "Erreur lors de l'envoi de la réponse au message texte", { 
                    status: whatsappResponse.status, 
                    response: errorText
                  });
                } else {
                  log("info", "Réponse au message texte envoyée avec succès");
                }
              } catch (textError) {
                log("error", "Erreur lors du traitement du message texte", { 
                  error: textError instanceof Error ? textError.message : String(textError),
                  stack: textError instanceof Error ? textError.stack : null,
                  senderNumber,
                  messageId
                });
                
                // Notification d'erreur à l'utilisateur
                try {
                  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
                    },
                    body: JSON.stringify({
                      to: senderNumber,
                      message: "Désolé, je n'ai pas pu traiter votre message. Veuillez réessayer."
                    })
                  });
                } catch (notifyError) {
                  log("error", "Échec de l'envoi du message d'erreur pour le texte", {
                    error: notifyError instanceof Error ? notifyError.message : String(notifyError)
                  });
                }
              }
            }
            // Autres types de messages (images, vidéos, etc.)
            else {
              log("info", "Type de message non géré", { 
                type: message.type, 
                senderNumber,
                messageId
              });
              
              // Notification à l'utilisateur pour les types non supportés
              try {
                await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
                  },
                  body: JSON.stringify({
                    to: senderNumber,
                    message: "Je peux traiter les messages texte et audio. Les autres types de médias ne sont pas encore pris en charge."
                  })
                });
              } catch (notifyError) {
                log("error", "Échec de l'envoi du message informatif", {
                  error: notifyError instanceof Error ? notifyError.message : String(notifyError)
                });
              }
            }
          }
        }
      }
    }
    
    // Réponse standard pour les webhooks Meta
    return new Response("EVENT_RECEIVED", { 
      status: 200,
      headers: corsHeaders
    });
    
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