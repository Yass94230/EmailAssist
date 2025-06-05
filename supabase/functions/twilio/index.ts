import { Twilio } from "npm:twilio@4.23.0";

interface TwilioRequest {
  to: string;
  message: string;
  channel?: 'whatsapp';
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: unknown;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const jsonHeaders = {
  "Content-Type": "application/json",
  ...corsHeaders,
};

const log = (level: string, message: string, data?: unknown) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data
  };
  console[level](JSON.stringify(entry));
  return entry;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    log('info', 'Réception d\'une nouvelle requête Twilio');
    
    const requestData = await req.json().catch((error) => {
      throw new Error('Invalid JSON in request body');
    });
    
    const { to, message, channel }: TwilioRequest = requestData;

    if (!to || !message) {
      const error = log('error', 'Paramètres manquants', { to, message });
      return new Response(
        JSON.stringify({ 
          error: "Le numéro de téléphone et le message sont requis",
          details: error
        }),
        {
          status: 400,
          headers: jsonHeaders,
        }
      );
    }

    const formattedTo = to.startsWith('+') ? to : `+${to}`;

    log('info', 'Numéros formatés', { formattedTo });

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    if (!accountSid || !authToken || !twilioNumber) {
      const error = log('error', 'Identifiants Twilio manquants');
      return new Response(
        JSON.stringify({ 
          error: "Les identifiants Twilio ne sont pas configurés",
          details: error
        }),
        {
          status: 500,
          headers: jsonHeaders,
        }
      );
    }

    const client = new Twilio(accountSid, authToken);

    log('info', 'Tentative d\'envoi du message Twilio');
    
    const twilioParams: any = {
      body: message,
    };

    if (channel === 'whatsapp') {
      twilioParams.from = `whatsapp:${twilioNumber}`;
      twilioParams.to = `whatsapp:${formattedTo}`;
    } else {
      twilioParams.from = twilioNumber;
      twilioParams.to = formattedTo;
    }

    const twilioResponse = await client.messages.create(twilioParams);

    log('info', 'Message Twilio envoyé avec succès', { messageId: twilioResponse.sid });

    return new Response(
      JSON.stringify({
        sid: twilioResponse.sid,
        status: twilioResponse.status,
        direction: twilioResponse.direction,
        dateCreated: twilioResponse.dateCreated
      }),
      {
        headers: jsonHeaders,
      }
    );
  } catch (error) {
    const logEntry = log('error', 'Erreur lors du traitement de la requête', {
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      stack: error instanceof Error ? error.stack : undefined
    });

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Échec de l'envoi du message",
        details: logEntry
      }),
      {
        status: 500,
        headers: jsonHeaders,
      }
    );
  }
});