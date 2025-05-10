import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { phoneNumber } = await req.json();

    if (!phoneNumber) {
      throw new Error("Le numéro de téléphone est requis");
    }

    // Créer un client Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuration Supabase manquante");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Générer un ID de session unique
    const sessionId = uuidv4();

    // Calculer la date d'expiration (24h)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Enregistrer la session
    const { error } = await supabase
      .from("email_connection_sessions")
      .insert({
        phone_number: phoneNumber,
        session_id: sessionId,
        expires_at: expiresAt.toISOString(),
      });

    if (error) throw error;

    // Construire l'URL de connexion
    const appUrl = Deno.env.get("APP_URL");
    if (!appUrl) throw new Error("APP_URL non configurée");

    const connectionUrl = `${appUrl}/connect?id=${sessionId}`;

    return new Response(
      JSON.stringify({ 
        success: true,
        url: connectionUrl,
        expiresAt: expiresAt.toISOString()
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Erreur:", error);
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