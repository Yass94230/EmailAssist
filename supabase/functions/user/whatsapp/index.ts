// supabase/functions/user/whatsapp/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// En-têtes CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

console.info('Fonction User WhatsApp démarrée');

Deno.serve(async (req: Request) => {
  // Gestion des requêtes OPTIONS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Récupération du client Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Configuration Supabase manquante");
      return new Response(
        JSON.stringify({ error: "Configuration Supabase manquante" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Parsing du corps de la requête
    const { phoneNumber } = await req.json();
    
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: "Le numéro de téléphone est requis" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Enregistrement du numéro WhatsApp ${phoneNumber}`);

    // Création d'un client Supabase pour accéder à la base de données
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Récupérer l'ID de session ou d'utilisateur (si disponible)
    let userId = null;
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { data: tokenData, error: tokenError } = await supabase.auth.getUser(token);
        
        if (!tokenError && tokenData?.user) {
          userId = tokenData.user.id;
        }
      }
    } catch (error) {
      console.warn("Impossible de récupérer l'ID utilisateur:", error);
      // Continuer sans ID utilisateur
    }

    // Enregistrer le numéro dans la base de données
    const { data, error } = await supabase
      .from('user_whatsapp')
      .upsert({
        user_id: userId,
        phone_number: phoneNumber,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select();

    if (error) {
      console.error("Erreur lors de l'enregistrement dans la base de données:", error);
      return new Response(
        JSON.stringify({ 
          error: "Erreur lors de l'enregistrement dans la base de données", 
          details: error.message 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Retourner le résultat
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Numéro WhatsApp enregistré avec succès",
        data
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