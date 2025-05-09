import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // Le numéro de téléphone
    const error = url.searchParams.get("error");

    if (error) {
      throw new Error(`Erreur d'authentification Google: ${error}`);
    }

    if (!code || !state) {
      throw new Error("Code d'autorisation ou état manquant");
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Configuration Google manquante");
    }

    // Échanger le code contre des tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Erreur lors de l'échange du code d'autorisation");
    }

    const tokens = await tokenResponse.json();

    // Récupérer l'email de l'utilisateur
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error("Erreur lors de la récupération des informations utilisateur");
    }

    const userInfo = await userInfoResponse.json();

    // Sauvegarder les tokens dans Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: dbError } = await supabase
      .from("gmail_credentials")
      .upsert({
        phone_number: state,
        email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: "phone_number"
      });

    if (dbError) {
      throw dbError;
    }

    // Rediriger vers l'application avec un message de succès
    const appUrl = new URL(Deno.env.get("APP_URL")!);
    appUrl.searchParams.append("success", "true");
    appUrl.searchParams.append("email", userInfo.email);

    return Response.redirect(appUrl.toString(), 302);
  } catch (error) {
    console.error("Erreur:", error);
    
    // Rediriger vers l'application avec un message d'erreur
    const appUrl = new URL(Deno.env.get("APP_URL")!);
    appUrl.searchParams.append("error", error instanceof Error ? error.message : "Erreur inconnue");
    
    return Response.redirect(appUrl.toString(), 302);
  }
});