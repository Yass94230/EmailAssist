// whatsapp-webhook.ts - Version améliorée pour le traitement audio bidirectionnel
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

console.info('WhatsApp Webhook function started');

/**
 * Convertit un ArrayBuffer en chaîne Base64 sans utiliser Buffer.from
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  try {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    // Écrire le contenu binaire en évitant les dépassements de pile
    // pour les gros fichiers
    const chunkSize = 1024 * 10; // 10KB par chunk
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.slice(i, Math.min(i + chunkSize, len));
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j]);
      }
    }
    
    return btoa(binary);
  } catch (error) {
    console.error("Erreur dans arrayBufferToBase64:", error);
    if (error instanceof RangeError) {
      console.error("Dépassement de pile, taille du buffer trop importante:", buffer.byteLength);
    }
    throw error;
  }
}

/**
 * Convertit une chaîne Base64 en Blob sans utiliser Buffer.from
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  try {
    const cleanBase64 = base64.replace(/^data:.*,/, '');
    const binaryString = atob(cleanBase64);
    const length = binaryString.length;
    
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: mimeType });
  } catch (error) {
    console.error('Erreur dans base64ToBlob:', error);
    return new Blob([], { type: mimeType });
  }
}

/**
 * Vérifie si la reconnaissance vocale est activée pour un utilisateur
 */
async function isVoiceRecognitionEnabled(phoneNumber: string, supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('voice_recognition_enabled')
      .eq('phone_number', phoneNumber)
      .maybeSingle();
    
    if (error) {
      console.error("Erreur lors de la vérification des paramètres audio:", error);
      // Par défaut, activer la reconnaissance vocale si une erreur se produit
      return true;
    }
    
    // Si aucun paramètre n'est trouvé ou si voice_recognition_enabled est null, activer par défaut
    if (!data) return true;
    
    return data.voice_recognition_enabled ?? true;
  } catch (error) {
    console.error("Erreur lors de la vérification de la reconnaissance vocale:", error);
    // Par défaut, activer la reconnaissance vocale
    return true;
  }
}

/**
 * Vérifie si les réponses audio sont activées pour un utilisateur et récupère le type de voix
 */
async function getAudioSettings(phoneNumber: string, supabase: any): Promise<{ audioEnabled: boolean; voiceType: string }> {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('audio_enabled, voice_type')
      .eq('phone_number', phoneNumber)
      .maybeSingle();
    
    if (error) {
      console.error("Erreur lors de la vérification des paramètres audio:", error);
      // Par défaut, activer l'audio avec voix Alloy
      return { audioEnabled: true, voiceType: 'alloy' };
    }
    
    // Si aucun paramètre n'est trouvé, activer par défaut
    if (!data) return { audioEnabled: true, voiceType: 'alloy' };
    
    return { 
      audioEnabled: data.audio_enabled ?? true, 
      voiceType: data.voice_type || 'alloy' 
    };
  } catch (error) {
    console.error("Erreur lors de la vérification des paramètres audio:", error);
    // Par défaut, activer l'audio avec voix Alloy
    return { audioEnabled: true, voiceType: 'alloy' };
  }
}

// Fonction pour envoyer un indicateur de saisie à l'utilisateur WhatsApp
async function sendTypingIndicator(to: string): Promise<void> {
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "+14155238886";

  if (!twilioAccountSid || !twilioAuthToken) {
    console.log("Configuration Twilio manquante, impossible d'envoyer l'indicateur de saisie");
    return;
  }

  try {
    // Assurez-vous que le numéro est au format correct
    const formattedTo = to.startsWith('+') ? to : `+${to}`;
    const formattedFrom = twilioWhatsAppNumber.startsWith('+') ? twilioWhatsAppNumber : `+${twilioWhatsAppNumber}`;
    
    console.log(`Envoi d'un indicateur de saisie à: ${formattedTo}`);
    
    // Endpoint pour envoyer les indicateurs de saisie WhatsApp
    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    
    // Pour WhatsApp, l'indicateur de saisie se fait via un message spécial avec le contenu "is typing..."
    // C'est une solution temporaire, car Twilio n'a pas d'API officielle pour les indicateurs de saisie WhatsApp
    const formData = new URLSearchParams();
    formData.append('To', `whatsapp:${formattedTo}`);
    formData.append('From', `whatsapp:${formattedFrom}`);
    formData.append('Body', `\u200C`); // Caractère invisible qui déclenche l'indicateur de saisie
    
    const response = await fetch(twilioEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
      },
      body: formData.toString()
    });
    
    if (!response.ok) {
      const responseText = await response.text();
      console.warn(`Échec de l'envoi de l'indicateur de saisie: ${response.status} - ${responseText.substring(0, 200)}`);
    } else {
      console.log("Indicateur de saisie envoyé avec succès");
    }
  } catch (error) {
    console.warn("Erreur lors de l'envoi de l'indicateur de saisie:", error);
    // On ignore l'erreur car cela ne doit pas bloquer le flux principal
  }
}

// Fonction pour transcrire un message vocal avec Claude
async function transcribeVoiceMessage(mediaUrl: string): Promise<string> {
  try {
    console.log("Début de la transcription du message vocal:", mediaUrl);
    
    // Ajout d'un en-tête User-Agent pour éviter les erreurs 403
    const audioResponse = await fetch(mediaUrl, {
      headers: {
        "User-Agent": "WhatsApp Audio Transcriber/1.0"
      }
    });
    
    if (!audioResponse.ok) {
      console.error(`Erreur lors de la récupération du fichier audio: ${audioResponse.status} ${audioResponse.statusText}`);
      
      // Essayer à nouveau avec des options différentes
      console.log("Nouvelle tentative avec des options différentes...");
      const retryResponse = await fetch(mediaUrl, {
        method: "GET",
        headers: {
          "Accept": "*/*",
          "User-Agent": "Mozilla/5.0 WhatsApp Audio Transcriber"
        }
      });
      
      if (!retryResponse.ok) {
        throw new Error(`Impossible de récupérer le fichier audio (${retryResponse.status}): ${retryResponse.statusText}`);
      }
      
      console.log("Récupération réussie après nouvelle tentative");
      
      const audioBuffer = await retryResponse.arrayBuffer();
      console.log(`Fichier audio récupéré, taille: ${audioBuffer.byteLength} octets`);
      
      // Si le fichier est vide ou trop petit, c'est probablement une erreur
      if (audioBuffer.byteLength < 100) {
        throw new Error("Fichier audio vide ou trop petit");
      }
      
      // Utiliser l'API Claude pour la transcription
      const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
      if (!CLAUDE_API_KEY) {
        throw new Error('Clé API Claude manquante');
      }

      // Convertir l'ArrayBuffer en Base64
      const audioBase64 = arrayBufferToBase64(audioBuffer);
      
      // Vérifier la taille des données base64 avant l'envoi
      console.log(`Audio converti en Base64, taille: ${audioBase64.length} caractères`);
      
      // Déterminer le type MIME en fonction de l'URL ou du contenu
      let mediaType = "audio/mp3"; // Type par défaut
      
      if (mediaUrl.includes(".ogg") || mediaUrl.includes(".oga")) {
        mediaType = "audio/ogg";
      } else if (mediaUrl.includes(".wav")) {
        mediaType = "audio/wav";
      } else if (mediaUrl.includes(".webm")) {
        mediaType = "audio/webm";
      } else if (mediaUrl.includes(".m4a")) {
        mediaType = "audio/mp4";
      } else if (mediaUrl.includes(".opus")) {
        mediaType = "audio/opus";
      }
      
      console.log("Type MIME détecté:", mediaType);
      console.log("Envoi à Claude pour transcription...");

      const transcriptionRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": CLAUDE_API_KEY,
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
                    data: audioBase64
                  }
                }
              ]
            }
          ]
        })
      });

      if (!transcriptionRes.ok) {
        const errorText = await transcriptionRes.text();
        console.error("Erreur de l'API Claude:", errorText);
        
        // Tenter de parser l'erreur pour avoir plus de détails
        try {
          const errorData = JSON.parse(errorText);
          const errorType = errorData.error?.type || "unknown";
          const errorMessage = errorData.error?.message || "Erreur inconnue";
          
          throw new Error(`Erreur de transcription (${errorType}): ${errorMessage}`);
        } catch (parseError) {
          throw new Error(`Erreur lors de la transcription: ${transcriptionRes.status} - ${errorText.substring(0, 100)}`);
        }
      }

      const transcriptionData = await transcriptionRes.json();
      if (!transcriptionData.content || !transcriptionData.content[0]?.text) {
        throw new Error("Format de réponse de transcription invalide");
      }
      
      const transcribedText = transcriptionData.content[0].text;
      console.log("Transcription réussie:", transcribedText);
      
      return transcribedText;
    } else {
      // Traitement normal si la première requête a réussi
      const audioBuffer = await audioResponse.arrayBuffer();
      console.log(`Fichier audio récupéré, taille: ${audioBuffer.byteLength} octets`);
      
      // Si le fichier est vide ou trop petit, c'est probablement une erreur
      if (audioBuffer.byteLength < 100) {
        throw new Error("Fichier audio vide ou trop petit");
      }
      
      // Utiliser l'API Claude pour la transcription
      const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
      if (!CLAUDE_API_KEY) {
        throw new Error('Clé API Claude manquante');
      }

      // Convertir l'ArrayBuffer en Base64
      const audioBase64 = arrayBufferToBase64(audioBuffer);
      
      // Vérifier la taille des données base64 avant l'envoi
      console.log(`Audio converti en Base64, taille: ${audioBase64.length} caractères`);
      
      // Déterminer le type MIME en fonction de l'URL ou du contenu
      let mediaType = "audio/mp3"; // Type par défaut
      
      if (mediaUrl.includes(".ogg") || mediaUrl.includes(".oga")) {
        mediaType = "audio/ogg";
      } else if (mediaUrl.includes(".wav")) {
        mediaType = "audio/wav";
      } else if (mediaUrl.includes(".webm")) {
        mediaType = "audio/webm";
      } else if (mediaUrl.includes(".m4a")) {
        mediaType = "audio/mp4";
      } else if (mediaUrl.includes(".opus")) {
        mediaType = "audio/opus";
      }
      
      console.log("Type MIME détecté:", mediaType);
      console.log("Envoi à Claude pour transcription...");

      const transcriptionRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": CLAUDE_API_KEY,
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
                    data: audioBase64
                  }
                }
              ]
            }
          ]
        })
      });

      if (!transcriptionRes.ok) {
        const errorText = await transcriptionRes.text();
        console.error("Erreur de l'API Claude:", errorText);
        
        // Tenter de parser l'erreur pour avoir plus de détails
        try {
          const errorData = JSON.parse(errorText);
          const errorType = errorData.error?.type || "unknown";
          const errorMessage = errorData.error?.message || "Erreur inconnue";
          
          throw new Error(`Erreur de transcription (${errorType}): ${errorMessage}`);
        } catch (parseError) {
          throw new Error(`Erreur lors de la transcription: ${transcriptionRes.status} - ${errorText.substring(0, 100)}`);
        }
      }

      const transcriptionData = await transcriptionRes.json();
      if (!transcriptionData.content || !transcriptionData.content[0]?.text) {
        throw new Error("Format de réponse de transcription invalide");
      }
      
      const transcribedText = transcriptionData.content[0].text;
      console.log("Transcription réussie:", transcribedText);
      
      return transcribedText;
    }
  } catch (error) {
    console.error('Erreur détaillée lors de la transcription:', error);
    throw error;
  }
}

// Fonction pour obtenir une réponse de Claude avec génération audio optionnelle
async function getClaudeResponse(prompt: string, generateAudio: boolean, voiceType: string = 'alloy'): Promise<{ text: string; audio?: string }> {
  try {
    console.log("Génération d'une réponse Claude", { generateAudio, voiceType });
    
    const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!CLAUDE_API_KEY) {
      throw new Error('Clé API Claude manquante');
    }

    // Obtenir une réponse textuelle de Claude
    const textResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
        max_tokens: 1000,
        temperature: 0.7,
        system: "Tu es un assistant email professionnel qui aide à gérer les emails et à rédiger des réponses appropriées. Tu communiques exclusivement en français.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      throw new Error(`Erreur API Claude: ${errorText}`);
    }

    const responseData = await textResponse.json();
    
    if (!responseData.content || !Array.isArray(responseData.content) || !responseData.content[0]?.text) {
      throw new Error("Format de réponse invalide");
    }

    const response = responseData.content[0].text;
    console.log("Réponse textuelle générée");

    // Si la génération audio n'est pas demandée, retourner uniquement le texte
    if (!generateAudio) {
      return { text: response };
    }

    // Générer l'audio de la réponse
    console.log("Génération de l'audio avec la voix:", voiceType);
    const speechRes = await fetch("https://api.anthropic.com/v1/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
        input: response,
        voice: voiceType,
        format: "mp3",
      }),
    });

    if (!speechRes.ok) {
      console.error("Erreur lors de la génération audio:", await speechRes.text());
      // En cas d'échec de la génération audio, retourner uniquement le texte
      return { text: response };
    }

    const audioBuffer = await speechRes.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioBuffer);
    console.log("Audio généré avec succès");

    return {
      text: response,
      audio: audioBase64
    };
  } catch (error) {
    console.error("Erreur lors de la génération de la réponse Claude:", error);
    throw error;
  }
}

// Fonction pour envoyer un message WhatsApp avec audio optionnel
async function sendWhatsAppMessage(to: string, text: string, audioData?: string) {
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "+14155238886";

  if (!twilioAccountSid || !twilioAuthToken) {
    throw new Error("Configuration Twilio manquante");
  }

  try {
    console.log("Envoi d'un message WhatsApp à:", to, { 
      hasText: !!text, 
      textLength: text?.length || 0,
      hasAudio: !!audioData,
      audioLength: audioData ? `${Math.floor(audioData.length / 1000)}KB` : '0'
    });
    
    // Assurez-vous que le numéro est au format correct
    const formattedTo = to.startsWith('+') ? to : `+${to}`;
    // Assurez-vous que le numéro WhatsApp est au format correct
    const formattedFrom = twilioWhatsAppNumber.startsWith('+') ? twilioWhatsAppNumber : `+${twilioWhatsAppNumber}`;
    
    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    
    // Si on a des données audio mais pas d'URL MediaURL, on envoie un message texte séparé
    // car Twilio ne peut pas envoyer directement des données audio en base64
    if (audioData) {
      console.log("Message audio détecté, mais impossible d'envoyer directement. Envoi du message texte uniquement.");
    }
    
    // Préparation du formulaire
    const formData = new URLSearchParams();
    formData.append('To', `whatsapp:${formattedTo}`);
    formData.append('From', `whatsapp:${formattedFrom}`);
    formData.append('Body', text);
    
    // Note: Pour envoyer un audio via Twilio WhatsApp, nous aurions besoin d'une URL accessible
    // publiquement pour le fichier audio. Dans une implémentation réelle, vous devriez
    // télécharger le fichier audio sur un service de stockage (S3, etc.) puis utiliser l'URL
    // dans MediaUrl. Pour l'instant, nous n'envoyons que le texte.

    // Envoi de la requête
    const twilioResponse = await fetch(twilioEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
      },
      body: formData.toString(),
    });

    const responseText = await twilioResponse.text();
    console.log("Réponse brute de Twilio:", responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
    
    if (!twilioResponse.ok) {
      throw new Error(`Erreur Twilio (${twilioResponse.status}): ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      console.warn("Impossible de parser la réponse JSON de Twilio:", error);
      data = { status: "unknown", sid: "unknown" };
    }
    
    console.log("Message WhatsApp envoyé avec succès, SID:", data.sid || "inconnu");
    
    return data;
  } catch (error) {
    console.error("Erreur lors de l'envoi du message WhatsApp:", error);
    
    // Essayons une seconde fois avec des paramètres différents en cas d'échec
    try {
      console.log("Nouvelle tentative d'envoi avec des paramètres alternatifs...");
      
      const formattedTo = to.startsWith('+') ? to : `+${to}`;
      const formattedFrom = twilioWhatsAppNumber.startsWith('+') ? twilioWhatsAppNumber : `+${twilioWhatsAppNumber}`;
      
      const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const formData = new URLSearchParams();
      
      // Utilisation d'un format alternatif
      formData.append('To', `whatsapp:${formattedTo}`);
      formData.append('From', `whatsapp:${formattedFrom}`);
      formData.append('Body', text.substring(0, 1500)); // Limiter la taille du message
      
      const retryResponse = await fetch(twilioEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        },
        body: formData.toString(),
      });
      
      if (!retryResponse.ok) {
        throw new Error(`Échec de la seconde tentative: ${retryResponse.status}`);
      }
      
      const data = await retryResponse.json();
      console.log("Message envoyé avec succès après seconde tentative");
      return data;
    } catch (retryError) {
      console.error("Échec de toutes les tentatives d'envoi:", retryError);
      throw error; // Renvoyer l'erreur originale
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    console.log("Requête reçue sur:", url.pathname);

    // Configuration Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuration Supabase manquante");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Debug: Afficher tous les headers pour vérifier le content-type
    console.log("Headers de la requête:");
    for (const [key, value] of req.headers.entries()) {
      console.log(`${key}: ${value}`);
    }
    
    // Traitement des webhooks Twilio WhatsApp
    let formData;
    try {
      formData = await req.formData();
      // Debug: Afficher toutes les clés du formData
      console.log("Clés du formData:");
      for (const key of formData.keys()) {
        console.log(`- ${key}: ${formData.get(key)}`);
      }
    } catch (formError) {
      console.error("Erreur lors de la récupération du formData:", formError);
      // Essayer de récupérer le corps en tant que JSON
      try {
        const jsonBody = await req.json();
        console.log("Corps JSON reçu:", jsonBody);
        
        // Créer un formData synthétique à partir du JSON
        formData = new FormData();
        if (jsonBody.From) formData.append('From', jsonBody.From);
        if (jsonBody.Body) formData.append('Body', jsonBody.Body);
        if (jsonBody.MediaUrl0) formData.append('MediaUrl0', jsonBody.MediaUrl0);
        if (jsonBody.MediaContentType0) formData.append('MediaContentType0', jsonBody.MediaContentType0);
      } catch (jsonError) {
        console.error("Erreur lors de la récupération du JSON:", jsonError);
        // Essayons de traiter le corps en texte brut
        try {
          const bodyText = await req.text();
          console.log("Corps de la requête (texte brut):", bodyText.substring(0, 500));
          
          // Vérifier si c'est un format de type URL encodé
          if (bodyText.includes('=') && bodyText.includes('&')) {
            const params = new URLSearchParams(bodyText);
            formData = new FormData();
            for (const [key, value] of params.entries()) {
              formData.append(key, value);
            }
            console.log("Paramètres extraits du corps texte:", Object.fromEntries(params.entries()));
          } else {
            throw new Error("Format de requête non supporté");
          }
        } catch (textError) {
          console.error("Erreur lors du traitement du texte brut:", textError);
          throw new Error("Format de requête non supporté");
        }
      }
    }
    
    // Extraire les informations importantes du formData avec plus de robustesse
    const messageBody = formData.get('Body') || formData.get('body') || '';
    const mediaContentType = formData.get('MediaContentType0') || formData.get('mediaContentType0') || '';
    const mediaUrl = formData.get('MediaUrl0') || formData.get('mediaUrl0') || '';
    
    // Numéro de téléphone de l'expéditeur - traiter plusieurs formats possibles
    const fromRaw = formData.get('From') || formData.get('from') || '';
    let from = '';
    
    if (typeof fromRaw === 'string') {
      from = fromRaw.replace('whatsapp:', '').trim();
    } else {
      console.log("Le champ 'From' n'est pas une chaîne de caractères:", fromRaw);
      // Tentative de conversion
      from = String(fromRaw).replace('whatsapp:', '').trim();
    }
    
    if (!from) {
      // Si on ne trouve toujours pas d'expéditeur, vérifions tous les champs pour le trouver
      console.log("Recherche du numéro d'expéditeur dans tous les champs...");
      for (const [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
        const valueStr = String(value);
        if (valueStr.includes('+') && (valueStr.length > 10 || valueStr.includes('whatsapp:'))) {
          from = valueStr.replace('whatsapp:', '').trim();
          console.log("Expéditeur potentiel trouvé dans le champ", key, ":", from);
          break;
        }
      }
    }
    
    if (!from) {
      throw new Error("Numéro d'expéditeur introuvable dans la requête");
    }
    
    console.log("Message reçu de:", from, {
      hasBody: !!messageBody,
      messageLength: typeof messageBody === 'string' ? messageBody.length : 'n/a',
      messageContent: typeof messageBody === 'string' ? messageBody.substring(0, 50) + '...' : 'n/a',
      hasMedia: !!mediaUrl,
      mediaType: mediaContentType || 'none',
      mediaUrl: mediaUrl || 'none'
    });
    
    // Pour les messages texte, assurez-vous que nous avons une chaîne valide
    const messageText = typeof messageBody === 'string' 
      ? messageBody 
      : (messageBody ? String(messageBody) : '');
    
    // Vérifier si la reconnaissance vocale est activée pour cet utilisateur
    const voiceRecognitionEnabled = await isVoiceRecognitionEnabled(from, supabase);
    console.log("Reconnaissance vocale activée:", voiceRecognitionEnabled);
    
    // Vérifier les préférences audio (réponses audio activées, type de voix)
    const { audioEnabled, voiceType } = await getAudioSettings(from, supabase);
    console.log("Préférences audio:", { audioEnabled, voiceType });
    
    let responseText = '';
    
    // Traitement d'un message audio - Condition améliorée pour détecter les fichiers audio
    // Utilisez une approche plus permissive pour la détection audio
    const isAudioMessage = (
      mediaUrl && 
      (
        (typeof mediaContentType === 'string' && mediaContentType.includes('audio')) ||
        (typeof mediaUrl === 'string' && (
          mediaUrl.includes('.mp3') || 
          mediaUrl.includes('.ogg') || 
          mediaUrl.includes('.wav') || 
          mediaUrl.includes('.m4a') ||
          mediaUrl.includes('.opus')
        ))
      )
    );
    
    if (isAudioMessage && voiceRecognitionEnabled) {
      try {
        // Envoyer l'indicateur de saisie immédiatement
        await sendTypingIndicator(from);
        
        console.log("Transcription d'un message audio:", mediaUrl.toString());
        const transcribedText = await transcribeVoiceMessage(mediaUrl.toString());
        console.log("Transcription réussie:", transcribedText);
        
        // Envoyer un autre indicateur de saisie pendant que Claude génère la réponse
        await sendTypingIndicator(from);
        
        // Obtenir une réponse basée sur la transcription
        const claudeResponse = await getClaudeResponse(
          transcribedText,
          audioEnabled,
          voiceType
        );
        console.log("Réponse Claude générée");
        
        // Envoyer la réponse (texte et audio si activé)
        await sendWhatsAppMessage(
          from,
          claudeResponse.text,
          claudeResponse.audio
        );
        
        responseText = "Message audio traité avec succès";
        
      } catch (error) {
        console.error("Erreur lors du traitement du message audio:", error);
        
        // Envoyer un message d'erreur à l'utilisateur
        await sendWhatsAppMessage(
          from,
          "Désolé, je n'ai pas pu traiter votre message vocal. Veuillez réessayer ou envoyer un message texte."
        );
        
        responseText = "Erreur lors du traitement du message audio";
      }
    } 
    // Traitement d'un message texte
    else if (messageText && messageText.trim().length > 0) {
      try {
        // Envoyer l'indicateur de saisie immédiatement
        await sendTypingIndicator(from);
        
        console.log("Traitement d'un message texte:", messageText.substring(0, 50) + 
          (messageText.length > 50 ? '...' : ''));
        
        // Obtenir une réponse à partir du texte
        const claudeResponse = await getClaudeResponse(
          messageText,
          audioEnabled,
          voiceType
        );
        
        // Envoyer la réponse (texte et audio si activé)
        await sendWhatsAppMessage(
          from,
          claudeResponse.text,
          claudeResponse.audio
        );
        
        responseText = "Message texte traité avec succès";
        
      } catch (error) {
        console.error("Erreur lors du traitement du message texte:", error);
        
        // Envoyer un message d'erreur à l'utilisateur
        await sendWhatsAppMessage(
          from,
          "Désolé, je n'ai pas pu traiter votre message. Veuillez réessayer."
        );
        
        responseText = "Erreur lors du traitement du message texte";
      }
    } else {
      // Aucun contenu exploitable
      console.log("Message sans contenu exploitable");
      
      await sendWhatsAppMessage(
        from,
        "Désolé, je n'ai reçu aucun contenu exploitable. Veuillez envoyer un message texte ou vocal."
      );
      
      responseText = "Message sans contenu exploitable";
    }
    
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        headers: {
          "Content-Type": "text/xml",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Erreur de traitement du webhook:", error);
    
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Une erreur est survenue</Message></Response>`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/xml",
          ...corsHeaders,
        },
      }
    );
  }
});