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

// Validation des données audio améliorée
function validateAudioData(audioData: string): boolean {
  if (!audioData) return false;
  
  // Vérification basique d'une chaîne base64 valide
  if (audioData.length < 100) {
    console.warn("Données audio trop courtes ou vides");
    return false;
  }

  // Vérifier si c'est une chaîne base64 valide avec une expression régulière plus permissive
  const base64Regex = /^[A-Za-z0-9+/]*={0,3}$/;
  const isBase64Valid = base64Regex.test(audioData);
    
  if (!isBase64Valid) {
    console.warn("Format base64 invalide");
    return false;
  }

  return true;
}

// Gestion des erreurs de l'API Claude
async function handleClaudeError(response: Response): Promise<never> {
  const errorText = await response.text();
  let errorDetails;
  try {
    errorDetails = JSON.parse(errorText);
  } catch {
    errorDetails = { error: errorText };
  }

  console.error("Erreur API Claude:", {
    status: response.status,
    details: errorDetails
  });

  throw new Error(`Erreur API Claude: ${response.status} - ${errorDetails.error || errorText}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    let requestData;
    try {
      requestData = await req.json();
      console.log("Données de requête reçues:", {
        hasPrompt: !!requestData.prompt,
        hasPhoneNumber: !!requestData.phoneNumber,
        isAudioInput: !!requestData.isAudioInput,
        generateAudio: !!requestData.generateAudio,
        hasAudioData: !!requestData.audioData,
        audioDataLength: requestData.audioData ? `${Math.floor(requestData.audioData.length / 1000)}K` : 'none',
        mimeType: requestData.mimeType || 'non spécifié'
      });
    } catch (parseError) {
      console.error("Erreur lors du parsing JSON:", parseError);
      return new Response(
        JSON.stringify({ error: "Format de requête invalide" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    const { 
      prompt, 
      phoneNumber, 
      generateAudio = true, 
      isAudioInput = false, 
      audioData, 
      voiceType = 'alloy',
      mimeType = 'audio/mp3' // Valeur par défaut pour le type MIME
    } = requestData;
    
    if (isAudioInput) {
      if (!audioData) {
        return new Response(
          JSON.stringify({ error: "Les données audio sont requises" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      if (!validateAudioData(audioData)) {
        return new Response(
          JSON.stringify({ error: "Format de données audio invalide" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    if (prompt?.toLowerCase().includes('connecter email')) {
      try {
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

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("Configuration de l'API Claude manquante");
    }

    let textResponse = "";
    
    if (isAudioInput && audioData) {
      try {
        console.log("Traitement de l'entrée audio...");
        
        // Déterminer le type MIME approprié
        const mediaType = mimeType || 'audio/mp3';
        console.log("Type MIME utilisé:", mediaType);
        
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
                      media_type: mediaType,
                      data: audioData
                    }
                  }
                ]
              }
            ]
          })
        });
        
        if (!audioProcessingRes.ok) {
          await handleClaudeError(audioProcessingRes);
        }
        
        const audioProcessingData = await audioProcessingRes.json();
        if (!audioProcessingData.content?.[0]?.text) {
          throw new Error("Format de réponse audio invalide");
        }
        
        textResponse = audioProcessingData.content[0].text;
        console.log("Transcription audio réussie:", textResponse.substring(0, 100) + '...');
      } catch (audioError) {
        console.error("Erreur détaillée lors du traitement audio:", audioError);
        return new Response(
          JSON.stringify({ 
            error: "Erreur lors du traitement audio",
            details: audioError instanceof Error ? audioError.message : String(audioError)
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    } else {
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
          await handleClaudeError(anthropicRes);
        }

        const data = await anthropicRes.json();
        
        if (!data.content || !Array.isArray(data.content) || !data.content[0]?.text) {
          throw new Error("Format de réponse invalide");
        }

        textResponse = data.content[0].text;
        console.log("Réponse textuelle générée:", textResponse.substring(0, 100) + '...');
      } catch (textError) {
        console.error("Erreur détaillée lors du traitement texte:", textError);
        throw new Error(`Erreur lors du traitement texte: ${textError instanceof Error ? textError.message : String(textError)}`);
      }
    }

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
        } else {
          const audioBuffer = await speechRes.arrayBuffer();
          audioResponse = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
          console.log("Audio généré avec succès, taille:", audioResponse.length);
        }
      } catch (audioGenError) {
        console.error("Erreur lors de la génération audio:", audioGenError);
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