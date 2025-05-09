// supabase/functions/whatsapp/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// En-têtes CORS pour permettre les appels depuis votre application
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

console.info('Fonction WhatsApp démarrée');

Deno.serve(async (req: Request) => {
  // Gestion des requêtes OPTIONS (pré-vol CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Récupération des clés API
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    
    if (!twilioAccountSid || !twilioAuthToken) {
      console.error("Clés API Twilio manquantes");
      return new Response(
        JSON.stringify({ error: "Configuration Twilio manquante" }),
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

    console.log(`Envoi d'un message WhatsApp à ${to}`);

    // Préparation de la requête Twilio pour WhatsApp
    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const formData = new URLSearchParams();
    formData.append('To', `whatsapp:${to}`); // Format WhatsApp pour Twilio
    formData.append('From', `whatsapp:+14155238886`);
    formData.append('Body', message);

    // Appel à l'API Twilio
    const twilioResponse = await fetch(twilioEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
      },
      body: formData.toString(),
    });

    // Gestion des erreurs de l'API Twilio
    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error("Erreur API Twilio:", errorText);
      
      let errorMessage = "Erreur lors de l'envoi du message WhatsApp";
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        // Si le texte n'est pas du JSON, on utilise le texte brut
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Erreur Twilio", 
          details: errorMessage 
        }),
        {
          status: twilioResponse.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Traitement de la réponse de Twilio
    const data = await twilioResponse.json();
    console.log("Réponse Twilio:", data.sid);

    // Retour de la réponse au client
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Message WhatsApp envoyé avec succès", 
        sid: data.sid 
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    // Gestion des erreurs générales
    console.error("Erreur serveur:", error);
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