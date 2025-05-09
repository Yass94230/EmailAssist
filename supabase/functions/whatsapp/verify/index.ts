// supabase/functions/whatsapp/verify/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// More permissive CORS headers for development
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

console.info('WhatsApp Verify function started');

Deno.serve(async (req: Request) => {
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get API keys
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
    
    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
      console.error("Missing Twilio configuration:", {
        hasSid: !!twilioAccountSid,
        hasToken: !!twilioAuthToken,
        hasWhatsAppNumber: !!twilioWhatsAppNumber
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Twilio configuration missing",
          verified: false
        }),
        {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          },
        }
      );
    }

    // Parse request body
    let phoneNumber;
    try {
      const body = await req.json();
      phoneNumber = body.phoneNumber;
    } catch (error) {
      console.error("Failed to parse request body:", error);
      return new Response(
        JSON.stringify({ 
          error: "Invalid request body",
          verified: false
        }),
        {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          },
        }
      );
    }
    
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ 
          error: "Phone number is required",
          verified: false 
        }),
        {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          },
        }
      );
    }

    console.log(`Verifying WhatsApp number: ${phoneNumber}`);

    // Call Twilio API to verify the number
    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const formData = new URLSearchParams();
    formData.append('To', `whatsapp:${phoneNumber}`);
    formData.append('From', `whatsapp:${twilioWhatsAppNumber}`);
    formData.append('Body', 'WhatsApp number verification');

    console.log('Calling Twilio API...');
    
    try {
      const twilioResponse = await fetch(twilioEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        },
        body: formData.toString(),
      });

      const twilioData = await twilioResponse.json();
      
      console.log('Twilio API response:', {
        status: twilioResponse.status,
        ok: twilioResponse.ok,
        errorCode: twilioData.code,
        errorMessage: twilioData.message
      });

      // Check if the number is verified based on Twilio's response
      const verified = twilioResponse.ok;

      return new Response(
        JSON.stringify({ 
          verified,
          status: twilioResponse.status,
          message: verified 
            ? "Number verified successfully" 
            : "Number not verified or not registered in Sandbox"
        }),
        {
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          },
        }
      );
    } catch (error) {
      console.error('Twilio API call failed:', error);
      return new Response(
        JSON.stringify({ 
          error: "Failed to verify number with Twilio",
          details: error instanceof Error ? error.message : String(error),
          verified: false
        }),
        {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders 
          },
        }
      );
    }
  } catch (error) {
    console.error("Server error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Server error",
        details: error instanceof Error ? error.message : String(error),
        verified: false
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
      }
    );
  }
});