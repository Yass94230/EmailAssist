// src/services/whatsapp.ts

interface SendMessageParams {
  to: string;
  message: string;
}

interface SendMessageResponse {
  success: boolean;
  message: string;
  sid?: string;
  error?: string;
  details?: string;
  retryAfter?: number;
}

/**
 * Implements exponential backoff retry logic
 */
const retry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  backoff = 2
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) {
      throw error;
    }
    
    // Check if error indicates service is down
    if (error instanceof Error && 
        error.message.includes("temporairement indisponible")) {
      // Longer delay for service outages
      await new Promise(resolve => setTimeout(resolve, delay * 2));
    } else {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    return retry(fn, retries - 1, delay * backoff, backoff);
  }
};

// Circuit breaker state
let failureCount = 0;
let lastFailureTime: number | null = null;
const FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_TIME = 5 * 60 * 1000; // 5 minutes

const isCircuitOpen = (): boolean => {
  if (failureCount >= FAILURE_THRESHOLD) {
    if (lastFailureTime && Date.now() - lastFailureTime < CIRCUIT_RESET_TIME) {
      return true;
    }
    // Reset circuit after reset time
    failureCount = 0;
    lastFailureTime = null;
  }
  return false;
};

/**
 * Envoie un message WhatsApp via la fonction Supabase
 */
export const sendMessage = async ({ to, message }: SendMessageParams): Promise<SendMessageResponse> => {
  try {
    console.log(`Tentative d'envoi d'un message WhatsApp à ${to}`);
    
    // Check circuit breaker
    if (isCircuitOpen()) {
      const waitTime = Math.ceil((CIRCUIT_RESET_TIME - (Date.now() - (lastFailureTime || 0))) / 1000);
      return {
        success: false,
        message: "Service temporairement désactivé",
        error: `Trop d'erreurs consécutives. Réessayez dans ${waitTime} secondes.`,
        retryAfter: waitTime
      };
    }
    
    // Vérifie que les paramètres sont valides
    if (!to || !message) {
      throw new Error("Le numéro de téléphone et le message sont requis");
    }
    
    // Normalisation du numéro de téléphone (s'assure qu'il commence par +)
    const formattedTo = to.startsWith('+') ? to : `+${to}`;
    
    // URL de la fonction Supabase
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp`;
    
    // Implémentation de la logique de retry avec exponential backoff
    return await retry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      try {
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ to: formattedTo, message }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Récupérer la réponse complète pour le débogage
        const responseText = await response.text();
        console.log(`Réponse de la fonction Supabase: ${response.status}`, {
          statusText: response.statusText,
          responsePreview: responseText.substring(0, 200)
        });
        
        // Parser le JSON uniquement si c'est possible
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error("Erreur de parsing JSON:", e);
          throw new Error(`Réponse invalide du serveur: ${responseText.substring(0, 500)}`);
        }
        
        if (!response.ok) {
          // Extraction des détails d'erreur spécifiques
          const errorDetails = data.error || data.details || responseText;
          const statusCode = response.status;
          
          // Gestion des erreurs spécifiques
          if (statusCode === 429) {
            throw new Error("Limite de requêtes atteinte. Veuillez réessayer dans quelques minutes.");
          } else if (statusCode === 401 || statusCode === 403) {
            throw new Error("Erreur d'authentification. Veuillez vous reconnecter.");
          } else if (statusCode >= 500) {
            failureCount++;
            lastFailureTime = Date.now();
            throw new Error("Le service WhatsApp est temporairement indisponible. Veuillez réessayer plus tard.");
          }
          
          throw new Error(`Erreur API (${statusCode}): ${errorDetails}`);
        }
        
        // Reset circuit breaker on success
        failureCount = 0;
        lastFailureTime = null;
        
        // Vérification de la structure de la réponse
        if (!data || typeof data !== 'object') {
          throw new Error("Format de réponse invalide");
        }
        
        return {
          success: true,
          message: data.message || "Message envoyé avec succès",
          sid: data.data?.messages?.[0]?.id
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error("La requête a expiré. Vérifiez votre connexion internet.");
        }
        
        // Enrichissement des messages d'erreur
        const errorMessage = fetchError instanceof Error ? fetchError.message : "Erreur inconnue";
        console.error("Erreur détaillée:", {
          error: fetchError,
          message: errorMessage,
          timestamp: new Date().toISOString()
        });
        
        throw new Error(`Échec de l'envoi: ${errorMessage}`);
      }
    }, 3, 1000, 2); // 3 tentatives, délai initial de 1s, multiplicateur de 2
    
  } catch (error) {
    console.error("Error in sendMessage:", {
      error,
      timestamp: new Date().toISOString(),
      context: { to, messageLength: message?.length }
    });
    
    // Construction d'un message d'erreur utilisateur plus informatif
    let userMessage = "Échec de l'envoi du message";
    let errorDetails = error instanceof Error ? error.message : "Erreur inconnue";
    let retryAfter: number | undefined;
    
    if (errorDetails.includes("temporairement indisponible")) {
      userMessage = "Le service WhatsApp est momentanément indisponible. Nous réessaierons automatiquement dans quelques minutes.";
      retryAfter = 300; // 5 minutes
    } else if (errorDetails.includes("limite de requêtes")) {
      userMessage = "Trop de messages envoyés. Veuillez patienter quelques minutes avant de réessayer.";
      retryAfter = 180; // 3 minutes
    } else if (errorDetails.includes("authentification")) {
      userMessage = "Votre session a expiré. Veuillez vous reconnecter.";
    }
    
    return {
      success: false,
      message: userMessage,
      error: errorDetails,
      details: error instanceof Error ? error.stack : undefined,
      retryAfter
    };
  }
};

/**
 * Vérifie si un numéro WhatsApp est valide
 */
export const verifyWhatsAppNumber = async (phoneNumber: string): Promise<boolean> => {
  try {
    // Envoie un message de test
    const result = await sendMessage({
      to: phoneNumber,
      message: "Vérification du numéro WhatsApp"
    });
    
    return result.success;
  } catch (error) {
    console.error('Error in verifyWhatsAppNumber:', error);
    return false;
  }
};

/**
 * Récupère le numéro WhatsApp de l'utilisateur courant
 */
export const getUserWhatsAppNumber = (): string | null => {
  return localStorage.getItem('userWhatsAppNumber');
};

/**
 * Envoie un message à l'utilisateur courant
 */
export const sendMessageToCurrentUser = async (message: string): Promise<SendMessageResponse> => {
  const phoneNumber = getUserWhatsAppNumber();
  
  if (!phoneNumber) {
    return {
      success: false,
      message: "Numéro WhatsApp non configuré",
      error: "Numéro WhatsApp non configuré. Veuillez configurer votre numéro dans les paramètres."
    };
  }
  
  return sendMessage({
    to: phoneNumber,
    message
  });
};