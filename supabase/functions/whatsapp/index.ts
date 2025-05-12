// supabase/functions/whatsapp/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

// Vérification des variables d'environnement requises
function checkRequiredEnvVars() {
  const required = [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID"
  ];
  
  const missing = required.filter(name => !Deno.env.get(name));
  
  if (missing.length > 0) {
    log("error", "Variables d'environnement requises manquantes", { missing });
    return false;
  }
  
  return true;
}

Deno.serve(async (req) => {
  // Gestion des requêtes preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  log("info", "Function d'envoi WhatsApp appelée", { method: req.method });

  try {
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

    // Parse request body
    let body;
    try {
      body = await req.json();
      log("info", "Corps de la requête reçu", { 
        hasTo: !!body.to, 
        hasMessage: !!body.message,
        messagePreview: body.message ? body.message.substring(0, 30) + "..." : null
      });
    } catch (parseError) {
      log("error", "Erreur lors du parsing du corps de la requête", { 
        error: parseError instanceof Error ? parseError.message : String(parseError)
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Format de requête invalide", 
          details: "Le corps de la requête doit être un objet JSON valide avec 'to' et 'message'"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    // Validation des paramètres requis
    const { to, message } = body;
    
    if (!to || !message) {
      log("error", "Paramètres manquants", { has: { to: !!to, message: !!message } });
      
      return new Response(
        JSON.stringify({ error: "Le numéro de téléphone (to) et le message sont requis" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Formater le numéro sans le + pour l'API WhatsApp si nécessaire
    const formattedTo = to.startsWith('+') ? to.substring(1) : to;
    
    // Récupérer les variables d'environnement nécessaires
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v18.0";
    
    // Construction correcte du corps de la requête
    const requestBody = JSON.stringify({
      messaging_product: "whatsapp", // IMPORTANT: Ce paramètre est requis
      recipient_type: "individual",
      to: formattedTo,
      type: "text",
      text: { 
        body: message
      }
    });
    
    log("info", "Envoi de message WhatsApp", {
      to: formattedTo,
      messageLength: message.length,
      messagePreview: message.substring(0, 50) + (message.length > 50 ? "..." : ""),
      url: `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`
    });
    
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: requestBody
      }
    );
    
    // Récupérer et journaliser la réponse
    let responseData;
    let responseText = "";
    
    try {
      responseText = await response.text();
      responseData = JSON.parse(responseText);
      log("info", "Réponse WhatsApp API", {
        status: response.status,
        data: responseData
      });
    } catch (e) {
      log("warn", "Impossible de parser la réponse JSON", { 
        status: response.status, 
        text: responseText 
      });
      responseData = { raw: responseText };
    }
    
    if (!response.ok) {
      log("error", "Erreur API WhatsApp", {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });
      
      return new Response(
        JSON.stringify({
          error: "Erreur lors de l'envoi du message WhatsApp",
          details: responseData,
          status: response.status
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    log("info", "Message WhatsApp envoyé avec succès", {
      to: formattedTo,
      messageId: responseData.messages?.[0]?.id
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Message WhatsApp envoyé avec succès",
        data: responseData
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    log("error", "Erreur non gérée", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null
    });
    
    return new Response(
      JSON.stringify({ 
        error: "Erreur serveur lors de l'envoi du message WhatsApp", 
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});