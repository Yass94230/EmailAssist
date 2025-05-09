interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: unknown;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const logEntry: LogEntry = await req.json();
    
    // Stockage des logs dans Deno.env ou un autre système de stockage
    console.log(JSON.stringify(logEntry));

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Échec de l'enregistrement du log"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});