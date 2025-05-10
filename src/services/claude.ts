import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SYSTEM_PROMPT = `Tu es un assistant email professionnel qui aide à gérer les emails et à rédiger des réponses appropriées. 
Tu communiques exclusivement en français.
Pour la connexion email, tu dois TOUJOURS utiliser le lien unique généré.
Tu ne dois JAMAIS mentionner d'URL générique ou demander à l'utilisateur d'aller sur une interface web.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { prompt, phoneNumber, generateAudio = true, voiceType = 'alloy', isAudioInput = false, audioData } = await req.json();
    
    if ((!prompt && !isAudioInput) || (isAudioInput && !audioData)) {
      throw new Error("Un prompt textuel ou des données audio sont requis");
    }

    // Traitement d'une entrée audio si fournie
    let finalPrompt = prompt;
    if (isAudioInput && audioData) {
      try {
        console.log("Traitement d'une entrée audio...");
        
        const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
        if (!apiKey) {
          throw new Error("Clé API Claude manquante");
        }
        
        // Utiliser l'API Claude pour transcrire l'audio
        const transcriptionRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-opus-20240229",
            max_tokens: 1000,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "audio",
                    source: {
                      type: "base64",
                      media_type: "audio/mp3",
                      data: audioData
                    }
                  }
                ]
              }
            ]
          })
        });

        if (!transcriptionRes.ok) {
          throw new Error("Erreur lors de la transcription audio");
        }

        const transcriptionData = await transcriptionRes.json();
        finalPrompt = transcriptionData.content[0].text;
        console.log("Audio transcrit:", finalPrompt);
      } catch (error) {
        console.error("Erreur transcription audio:", error);
        throw new Error("Erreur lors de la transcription audio: " + (error instanceof Error ? error.message : String(error)));
      }
    }

    // Si l'utilisateur demande de connecter son email
    if (finalPrompt.toLowerCase().includes('connecter email')) {
      try {
        // Générer un lien unique
        const connectResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/email-connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ phoneNumber })
        });

        if (!connectResponse.ok) {
          throw new Error("Erreur lors de la génération du lien de connexion");
        }

        const { url } = await connectResponse.json();
        const responseText = `Pour connecter votre compte email, cliquez sur ce lien :\n\n${url}\n\nCe lien est valable pendant 24 heures et ne peut être utilisé qu'une seule fois pour des raisons de sécurité.`;
        
        // Si la génération audio est demandée
        let audioResponse;
        if (generateAudio) {
          try {
            const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
            const speechRes = await fetch("https://api.anthropic.com/v1/speech", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-3-opus-20240229",
                input: responseText,
                voice: voiceType || "alloy",
                format: "mp3",
              }),
            });

            if (!speechRes.ok) {
              throw new Error("Erreur lors de la génération audio");
            }

            const audioBuffer = await speechRes.arrayBuffer();
            audioResponse = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
          } catch (audioError) {
            console.error("Erreur génération audio:", audioError);
          }
        }
        
        return new Response(
          JSON.stringify({ 
            response: responseText,
            audio: audioResponse 
          }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      } catch (error) {
        console.error("Erreur lors de la génération du lien:", error);
        throw error;
      }
    }

    // Pour les autres requêtes, utiliser l'API Claude
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("Clé API Claude manquante");
    }

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
        messages: [{ role: "user", content: finalPrompt }],
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
            voice: voiceType || "alloy",
            format: "mp3",
          }),
        });

        if (!speechRes.ok) {
          throw new Error("Erreur lors de la génération audio");
        }

        const audioBuffer = await speechRes.arrayBuffer();
        audioResponse = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      } catch (error) {
        console.error("Erreur génération audio:", error);
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