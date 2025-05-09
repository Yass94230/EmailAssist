import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp/mod.ts";

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
    const { sessionId, email, provider, config } = await req.json();

    if (!sessionId || !email || !provider) {
      throw new Error("Paramètres manquants");
    }

    // Valider la configuration IMAP/SMTP si fournie
    if (provider === 'manual' && config) {
      try {
        const client = new SmtpClient();
        await client.connect({
          hostname: config.smtp.host,
          port: config.smtp.port,
          username: config.auth.user,
          password: config.auth.pass,
        });
        await client.close();
      } catch (error) {
        throw new Error("Configuration SMTP invalide");
      }
    }

    // Sauvegarder dans Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: dbError } = await supabase
      .from("email_credentials")
      .upsert({
        session_id: sessionId,
        email,
        provider,
        config: config || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (dbError) {
      throw dbError;
    }

    return new Response(
      JSON.stringify({ success: true }),
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