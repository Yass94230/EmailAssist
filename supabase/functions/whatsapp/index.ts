// supabase/functions/whatsapp/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Utilitaire de logs amélioré
const log = (level: string, message: string, data?: any) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data: data || null
  };
  console[level](JSON.stringify(logEntry));
};

// Fonction pour envoyer un message WhatsApp via l'API Meta
async function sendWhatsAppMessage(to: string, message: string) {
  // Vérification et récupération des variables d'environnement
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v17.0";
  
  // Vérifications détaillées des variables d'environnement
  if (!phoneNumberId) {
    throw new Error("Configuration WhatsApp manquante: WHATSAPP_PHONE_NUMBER_ID");
  }
  
  if (!accessToken) {
    throw new Error("Configuration WhatsApp manquante: WHATSAPP_ACCESS_TOKEN");
  }
  
  // Validation des données d'entrée
  if (!to || typeof to !== 'string') {
    throw new Error("Numéro de destination manquant ou invalide");
  }
  
  if (!message || typeof message !== 'string') {
    throw new Error("Message manquant ou invalide");
  }
  
  // Formater le numéro sans le + pour l'API WhatsApp
  const formattedTo = to.startsWith('+') ? to.substring(1) : to;
  
  try {
    log("info", `Envoi message WhatsApp`, { 
      to: formattedTo,
      messageLength: message.length,
      messagePreview: message.substring(0, 50) + (message.length > 50 ? "..." : "")
    });
    
    // Création du corps de la requête
    const requestBody = JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedTo,
      type: "text",
      text: { 
        body: message
      }
    });
    
    log("info", "Requête API WhatsApp préparée", {
      url: `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      method: "POST",
      bodyLength: requestBody.length
    });
    
    // Envoi de la requête à l'API WhatsApp
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
    
    // Récupération complète du corps de la réponse
    const responseText = await response.text();
    
    log("info", "Réponse API WhatsApp reçue", { 
      status: response.status,
      statusText: response.statusText,
      responseLength: responseText.length,
      responsePreview: responseText.substring(0, 200) + (responseText.length > 200 ? "..." : "")
    });
    
    // Tentative de parsing du JSON
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      log("warn", "La réponse n'est pas un JSON valide", { 
        error: parseError instanceof Error ? parseError.message : String(parseError)
      });
      
      // Si le parsing échoue, créer un objet avec les informations disponibles
      data = { 
        status: response.status,
        rawResponse: responseText.substring(0, 500)
      };
    }
    
    // Gestion des erreurs dans la réponse
    if (!response.ok) {
      // Extraction des détails d'erreur pour un message plus informatif
      const errorDetails = data.error ? 
        `${data.error.type || 'Unknown'}: ${data.error.message || 'No message'}` : 
        `Status ${response.status}`;
      
      log("error", `Erreur API WhatsApp`, {
        status: response.status,
        details: errorDetails,
        data: data
      });
      
      throw new Error(`Erreur API WhatsApp (${response.status}): ${errorDetails}`);
    }
    
    // Log du succès
    log("info", "Message WhatsApp envoyé avec succès", { 
      messageId: data?.messages?.[0]?.id || 'unknown' 
    });
    
    return data;
  } catch (error) {
    // Log détaillé de l'erreur
    log("error", "Erreur lors de l'envoi du message WhatsApp", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      to: formattedTo
    });
    
    // Relance de l'erreur pour être traitée par l'appelant
    throw error;
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
    // Log de la requête entrante
    log("info", `Requête reçue`, { 
      method: req.method,
      url: req.url,
      headers: Object.fromEntries([...req.headers.entries()].filter(([key]) => !key.includes('auth')))
    });
    
    // Vérification rapide des variables d'environnement
    const missingVars = [];
    if (!Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")) missingVars.push("WHATSAPP_PHONE_NUMBER_ID");
    if (!Deno.env.get("WHATSAPP_ACCESS_TOKEN")) missingVars.push("WHATSAPP_ACCESS_TOKEN");
    
    if (missingVars.length > 0) {
      log("error", "Variables d'environnement manquantes", { missing: missingVars });
      
      return new Response(
        JSON.stringify({
          error: "Configuration WhatsApp manquante",
          details: `Les variables suivantes doivent être définies: ${missingVars.join(', ')}`
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    // Parsing du corps de la requête
    let body;
    try {
      body = await req.json();
      log("info", "Corps de la requête", { 
        hasTo: !!body.to,
        hasMessage: !!body.message,
        messageLength: body.message?.length
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

    // Envoi du message
    const result = await sendWhatsAppMessage(to, message);
    
    // Réponse avec succès
    log("info", "Traitement réussi", { result });
    
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
    log("error", "Erreur non gérée lors du traitement de la requête", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null
    });
    
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