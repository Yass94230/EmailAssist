// Edge Function claude.ts - Version corrigée pour éviter les erreurs .from()
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SYSTEM_PROMPT = `Tu es un assistant email professionnel qui aide à gérer les emails et à rédiger des réponses appropriées. 
Tu communiques exclusivement en français et tu es basé sur Claude de Anthropic.
Tu peux :
- Lire et résumer les emails
- Rédiger des réponses
- Rechercher des emails spécifiques
- Marquer des emails comme lus
- Déplacer des emails vers des dossiers
- Gérer les emails prioritaires
- Analyser les pièces jointes
Tu dois toujours être professionnel, courtois et efficace dans tes réponses.`;

/**
 * Convertit un ArrayBuffer en chaîne Base64 sans utiliser Buffer.from
 * Cette version fonctionne dans Deno et évite les erreurs "from is not a function"
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("Clé API Claude manquante");
    }

    const { prompt, accessToken, action, emailData, generateAudio = true, voiceType = "alloy" } = await req.json();
    
    if (!prompt) {
      throw new Error("Le prompt est requis");
    }

    let enhancedPrompt = prompt;
    if (action && emailData) {
      enhancedPrompt = `Action demandée: ${action}\nDonnées email: ${JSON.stringify(emailData)}\nRequête: ${prompt}`;
    }

    console.log("Envoi du prompt à Claude:", enhancedPrompt.substring(0, 100) + "...");

    // Générer la réponse textuelle
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
        max_tokens: 1000,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: enhancedPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errorText = await anthropicRes.text();
      throw new Error(`Erreur API Claude: ${errorText}`);
    }

    const data = await anthropicRes.json();
    
    if (!data.content || !Array.isArray(data.content) || !data.content[0]?.text) {
      throw new Error("Format de réponse invalide");
    }

    const textResponse = data.content[0].text;

    // Générer l'audio si demandé
    let audioResponse;
    if (generateAudio) {
      try {
        const speechRes = await fetch("https://api.anthropic.com/v1/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-opus-20240229",
            input: textResponse,
            voice: voiceType, // Utiliser le paramètre voiceType
            format: "mp3",
          }),
        });

        if (!speechRes.ok) {
          throw new Error("Erreur lors de la génération audio");
        }

        const audioBuffer = await speechRes.arrayBuffer();
        
        // Utiliser notre fonction sécurisée au lieu de Buffer.from
        audioResponse = arrayBufferToBase64(audioBuffer);
      } catch (error) {
        console.error("Erreur génération audio:", error);
        // Continuer sans audio en cas d'erreur
      }
    }

    // Si une action Gmail est nécessaire, l'exécuter
    if (action && accessToken) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('email_actions')
          .insert({
            action: action,
            email_id: emailData?.id,
            result: textResponse,
            metadata: emailData
          });
      }
    }

    return new Response(
      JSON.stringify({ 
        response: textResponse,
        audio: audioResponse 
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
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