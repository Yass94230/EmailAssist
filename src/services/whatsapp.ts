// src/services/whatsapp.ts

interface SendMessageParams {
  to: string;
  message: string;
}

// Type de réponse
interface SendMessageResponse {
  success: boolean;
  message: string;
  sid?: string;
  error?: string;
  details?: string;
}

/**
 * Envoie un message WhatsApp via la fonction Supabase
 */
export const sendMessage = async ({ to, message }: SendMessageParams): Promise<SendMessageResponse> => {
  try {
    console.log(`Tentative d'envoi d'un message WhatsApp à ${to}`);
    
    // Vérifie que les paramètres sont valides
    if (!to || !message) {
      throw new Error("Le numéro de téléphone et le message sont requis");
    }
    
    // Normalisation du numéro de téléphone (s'assure qu'il commence par +)
    const formattedTo = to.startsWith('+') ? to : `+${to}`;
    
    // URL de la fonction Supabase
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp`;
    
    // Requête avec retry et timeout
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
      console.log(`Réponse de la fonction Supabase: ${response.status}`, responseText.substring(0, 200));
      
      // Parser le JSON uniquement si c'est possible
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Erreur de parsing JSON:", e);
        // Si la réponse n'est pas un JSON valide, créer un objet avec les informations disponibles
        data = { 
          success: false, 
          error: "Réponse invalide du serveur", 
          details: responseText.substring(0, 500) 
        };
      }
      
      if (!response.ok) {
        throw new Error(`Erreur API (${response.status}): ${data.error || data.details || responseText}`);
      }
      
      return {
        success: true,
        message: data.message || "Message envoyé avec succès",
        sid: data.data?.messages?.[0]?.id
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Gestion spécifique des erreurs d'abort
      if (fetchError.name === 'AbortError') {
        throw new Error("La requête a expiré après 30 secondes. Vérifiez votre connexion ou contactez le support.");
      }
      
      // Relance des autres erreurs
      throw fetchError;
    }
  } catch (error) {
    console.error("Error in sendMessage:", error);
    
    return {
      success: false,
      message: "Échec de l'envoi du message",
      error: error instanceof Error ? error.message : "Erreur inconnue"
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