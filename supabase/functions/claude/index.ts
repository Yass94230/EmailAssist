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
  // Gestion des requêtes OPTIONS (CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Récupération et validation des données de la requête
    let requestData;
    try {
      requestData = await req.json();
      console.log("Données de requête reçues:", {
        hasPrompt: !!requestData.prompt,
        hasPhoneNumber: !!requestData.phoneNumber,
        isAudioInput: !!requestData.isAudioInput,
        generateAudio: !!requestData.generateAudio,
        hasAudioData: !!requestData.audioData,
        audioDataLength: requestData.audioData ? `${Math.floor(requestData.audioData.length / 1000)}K` : 'none'
      });
    } catch (parseError) {
      console.error("Erreur lors du parsing JSON:", parseError);
      throw new Error("Format de requête invalide");
    }
    
    const { prompt, phoneNumber, generateAudio = true, isAudioInput = false, audioData, voiceType = 'alloy' } = requestData;
    
    // Validation des paramètres
    if (isAudioInput && !audioData) {
      throw new Error("Les données audio sont requises pour le traitement audio");
    }

    // Si l'utilisateur demande de connecter son email
    if (prompt && prompt.toLowerCase().includes('connecter email')) {
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
          console.error("Erreur lors de la génération du lien:", {
            status: connectResponse.status,
            statusText: connectResponse.statusText
          });
          throw new Error("Erreur lors de la génération du lien de connexion");
        }

        const { url } = await connectResponse.json();
        
        return new Response(
          JSON.stringify({ 
            response: `Pour connecter votre compte email, cliquez sur ce lien :\n\n${url}\n\nCe lien est valable pendant 24 heures et ne peut être utilisé qu'une seule fois pour des raisons de sécurité.`
          }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      } catch (error) {
        console.error("Erreur détaillée lors de la génération du lien:", error);
        throw error;
      }
    }

    // Vérification de la clé API Claude
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error("Clé API Claude manquante dans les variables d'environnement");
      throw new Error("Configuration de l'API Claude manquante");
    }

    let textResponse = "";
    
    // Traitement audio si demandé
    if (isAudioInput && audioData) {
      try {
        console.log("Traitement de l'entrée audio...");
        
        // Validation du format des données audio
        if (!audioData.match(/^[A-Za-z0-9+/=]+$/)) {
          throw new Error("Format de données audio invalide");
        }
        
        // Appel à l'API Claude pour le traitement audio
        const audioProcessingRes = await fetch("https://api.anthropic.com/v1/messages", {
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
        
        if (!audioProcessingRes.ok) {
          const errorText = await audioProcessingRes.text();
          console.error("Erreur API Claude (traitement audio):", errorText);
          throw new Error(`Erreur lors du traitement audio: ${audioProcessingRes.status}`);
        }
        
        const audioProcessingData = await audioProcessingRes.json();
        textResponse = audioProcessingData.content[0].text;
        console.log("Transcription audio réussie:", textResponse.substring(0, 100) + '...');
      } catch (audioError) {
        console.error("Erreur détaillée lors du traitement audio:", audioError);
        throw new Error(`Erreur lors du traitement audio: ${audioError instanceof Error ? audioError.message : String(audioError)}`);
      }
    } else {
      // Traitement texte classique avec l'API Claude
      try {
        console.log("Traitement de l'entrée texte...");
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
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!anthropicRes.ok) {
          const errorText = await anthropicRes.text();
          console.error("Erreur API Claude (traitement texte):", errorText);
          throw new Error(`Erreur API Claude: ${errorText}`);
        }

        const data = await anthropicRes.json();
        
        if (!data.content || !Array.isArray(data.content) || !data.content[0]?.text) {
          console.error("Format de réponse invalide:", data);
          throw new Error("Format de réponse invalide");
        }

        textResponse = data.content[0].text;
        console.log("Réponse textuelle générée:", textResponse.substring(0, 100) + '...');
      } catch (textError) {
        console.error("Erreur détaillée lors du traitement texte:", textError);
        throw new Error(`Erreur lors du traitement texte: ${textError instanceof Error ? textError.message : String(textError)}`);
      }
    }

    // Générer l'audio si demandé
    let audioResponse;
    if (generateAudio && textResponse) {
      try {
        console.log("Génération de l'audio avec la voix:", voiceType);
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
            voice: voiceType,
            format: "mp3",
          }),
        });

        if (!speechRes.ok) {
          console.error("Erreur lors de la génération audio:", {
            status: speechRes.status,
            statusText: speechRes.statusText
          });
          // Ne pas échouer complètement, juste renvoyer la réponse texte sans audio
          console.log("Envoi de la réponse texte sans audio");
        } else {
          const audioBuffer = await speechRes.arrayBuffer();
          audioResponse = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
          console.log("Audio généré avec succès, taille:", audioResponse.length);
        }
      } catch (audioGenError) {
        console.error("Erreur lors de la génération audio:", audioGenError);
        // Ne pas échouer complètement, juste renvoyer la réponse texte sans audio
        console.log("Envoi de la réponse texte sans audio après erreur de génération");
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
    console.error("Erreur détaillée serveur:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'Stack non disponible'
    });
    
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