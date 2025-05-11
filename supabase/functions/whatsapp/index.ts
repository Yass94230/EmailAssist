// supabase/functions/whatsapp/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Utilitaire de logs
const log = (level: string, message: string, data?: any) => {
  console[level](`[WhatsApp] ${message}`, data || '');
};

// Fonction pour envoyer un message WhatsApp via l'API Meta
async function sendWhatsAppMessage(to: string, message: string) {
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v17.0";
  
  if (!phoneNumberId || !accessToken) {
    throw new Error("Configuration WhatsApp manquante (ID ou token)");
  }
  
  // Formater le numéro sans le + pour l'API WhatsApp
  const formattedTo = to.startsWith('+') ? to.substring(1) : to;
  
  try {
    log("info", `Envoi message WhatsApp à ${formattedTo}`, { messageLength: message.length });
    
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
    
    // Obtenir la réponse complète pour le débogage
    const responseText = await response.text();
    log("info", "Réponse brute de l'API WhatsApp:", { 
      status: response.status, 
      responsePreview: responseText.substring(0, 200) 
    });
    
    // Parser la réponse JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      log("warn", "Impossible de parser la réponse JSON", { error: e });
      // Créer un objet avec les informations disponibles
      data = { 
        status: response.status, 
        rawResponse: responseText.substring(0, 500)
      };
    }
    
    if (!response.ok) {
      const errorDetails = data.error ? 
        `${data.error.type || 'Unknown'}: ${data.error.message || 'No message'}` : 
        `Status ${response.status}`;
      
      throw new Error(`Erreur API WhatsApp: ${errorDetails}`);
    }
    
    log("info", "Message WhatsApp envoyé avec succès", { 
      messageId: data?.messages?.[0]?.id || 'unknown' 
    });
    
    return data;
  } catch (error) {
    log("error", "Erreur lors de l'envoi du message WhatsApp:", error);
    throw error;
  }
}

// Fonction pour envoyer un indicateur de saisie
async function sendTypingIndicator(to: string): Promise<void> {
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v17.0";
  
  if (!phoneNumberId || !accessToken) {
    log("warn", "Configuration WhatsApp manquante pour l'indicateur de saisie");
    return;
  }
  
  // Formater le numéro sans le + pour l'API WhatsApp
  const formattedTo = to.startsWith('+') ? to.substring(1) : to;
  
  try {
    log("info", `Envoi indicateur de saisie à ${formattedTo}`);
    
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
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: "..."
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: "typing",
                    title: "Typing"
                  }
                }
              ]
            }
          }
        })
      }
    );
    
    const responseText = await response.text();
    
    if (!response.ok) {
      log("warn", `Échec de l'envoi de l'indicateur de saisie:`, {
        status: response.status,
        response: responseText.substring(0, 200)
      });
    } else {
      log("info", "Indicateur de saisie envoyé avec succès");
    }
  } catch (error) {
    log("warn", "Erreur lors de l'envoi de l'indicateur de saisie:", error);
    // Nous ignorons l'erreur car l'indicateur de saisie est optionnel
  }
}

// Point d'entrée principal
serve(async (req) => {
  // Gestion CORS pour les requêtes preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Vérification de l'existence des variables d'environnement
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    
    if (!phoneNumberId || !accessToken) {
      log("error", "Configuration WhatsApp manquante", { 
        hasPhoneNumberId: !!phoneNumberId, 
        hasAccessToken: !!accessToken
      });
      
      return new Response(
        JSON.stringify({
          error: "Configuration WhatsApp manquante",
          details: "Les variables d'environnement WHATSAPP_PHONE_NUMBER_ID et WHATSAPP_ACCESS_TOKEN doivent être définies"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    // Parsing du corps de la requête
    const { to, message } = await req.json();
    
    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Le numéro de téléphone et le message sont requis" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    log("info", `Requête d'envoi de message à ${to}`, { 
      messagePreview: message.substring(0, 50) + (message.length > 50 ? "..." : "") 
    });
    
    // Optionnel: envoyer l'indicateur de saisie avant le message
    try {
      await sendTypingIndicator(to);
    } catch (typingError) {
      log("warn", "Erreur lors de l'envoi de l'indicateur de saisie (non bloquant):", typingError);
    }
    
    // Envoyer le message principal
    const result = await sendWhatsAppMessage(to, message);
    
    // Réponse avec succès
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Message WhatsApp envoyé avec succès", 
        data: result
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    // Journalisation détaillée de l'erreur
    log("error", "Erreur lors du traitement de la requête:", error);
    
    // Réponse avec erreur
    return new Response(
      JSON.stringify({ 
        error: "Erreur lors de l'envoi du message WhatsApp", 
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});