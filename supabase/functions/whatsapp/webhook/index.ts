// whatsapp-webhook.ts - Version améliorée avec indicateur de frappe
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

console.info('WhatsApp Webhook function started');

// ... (autres fonctions utilitaires inchangées)

// Fonction améliorée pour l'indicateur de frappe
async function sendTypingIndicator(to: string, isAudioMessage: boolean = false) {
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "+14155238886";

  if (!twilioAccountSid || !twilioAuthToken) {
    throw new Error("Configuration Twilio manquante");
  }

  try {
    const formattedTo = to.startsWith('+') ? to : `+${to}`;
    const formattedFrom = twilioWhatsAppNumber.startsWith('+') ? twilioWhatsAppNumber : `+${twilioWhatsAppNumber}`;
    
    const message = isAudioMessage 
      ? "L'assistant traite votre message vocal..." 
      : "L'assistant est en train d'écrire...";

    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const formData = new URLSearchParams();
    
    formData.append('To', `whatsapp:${formattedTo}`);
    formData.append('From', `whatsapp:${formattedFrom}`);
    formData.append('Body', message);

    const response = await fetch(twilioEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.warn("Échec de l'envoi de l'indicateur de frappe:", await response.text());
    }
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'indicateur de frappe:", error);
    // On continue même si l'envoi de l'indicateur échoue
  }
}

// ... (autres fonctions utilitaires inchangées)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // ... (code de configuration initial inchangé)

    const isAudioMessage = mediaUrl && (
      (typeof mediaContentType === 'string' && mediaContentType.includes('audio')) ||
      (typeof mediaUrl === 'string' && (
        mediaUrl.includes('.mp3') || 
        mediaUrl.includes('.ogg') || 
        mediaUrl.includes('.wav') || 
        mediaUrl.includes('.m4a') ||
        mediaUrl.includes('.opus')
      ))
    );

    // Envoyer l'indicateur approprié selon le type de message
    await sendTypingIndicator(from, isAudioMessage);
    
    if (isAudioMessage && voiceRecognitionEnabled) {
      try {
        console.log("Transcription d'un message audio:", mediaUrl.toString());
        const transcribedText = await transcribeVoiceMessage(mediaUrl.toString());
        console.log("Transcription réussie:", transcribedText);
        
        // Envoyer un nouvel indicateur pour la génération de réponse
        await sendTypingIndicator(from, false);
        
        const claudeResponse = await getClaudeResponse(
          transcribedText,
          audioEnabled,
          voiceType
        );
        console.log("Réponse Claude générée");
        
        await sendWhatsAppMessage(
          from,
          claudeResponse.text,
          claudeResponse.audio
        );
        
        responseText = "Message audio traité avec succès";
      } catch (error) {
        console.error("Erreur lors du traitement du message audio:", error);
        await sendWhatsAppMessage(
          from,
          "Désolé, je n'ai pas pu traiter votre message vocal. Veuillez réessayer ou envoyer un message texte."
        );
        responseText = "Erreur lors du traitement du message audio";
      }
    } else if (messageBody) {
      try {
        console.log("Traitement d'un message texte:", messageBody.toString().substring(0, 50) + '...');
        
        const claudeResponse = await getClaudeResponse(
          messageBody.toString(),
          audioEnabled,
          voiceType
        );
        
        await sendWhatsAppMessage(
          from,
          claudeResponse.text,
          claudeResponse.audio
        );
        
        responseText = "Message texte traité avec succès";
      } catch (error) {
        console.error("Erreur lors du traitement du message texte:", error);
        await sendWhatsAppMessage(
          from,
          "Désolé, je n'ai pas pu traiter votre message. Veuillez réessayer."
        );
        responseText = "Erreur lors du traitement du message texte";
      }
    } else {
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