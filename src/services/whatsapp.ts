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

// Circuit breaker configuration
const FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_TIME = 5 * 60 * 1000; // 5 minutes
const MIN_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 1 minute
const JITTER_MAX = 1000; // Maximum random jitter in milliseconds

// Circuit breaker state
let failureCount = 0;
let lastFailureTime: number | null = null;
let circuitOpenUntil: number | null = null;

// Add random jitter to retry delay
const addJitter = (delay: number): number => {
  return delay + Math.random() * JITTER_MAX;
};

// Calculate exponential backoff delay
const getBackoffDelay = (attempt: number): number => {
  const delay = Math.min(
    MIN_RETRY_DELAY * Math.pow(2, attempt),
    MAX_RETRY_DELAY
  );
  return addJitter(delay);
};

// Check if circuit breaker is open
const isCircuitOpen = (): boolean => {
  if (circuitOpenUntil && Date.now() < circuitOpenUntil) {
    return true;
  }
  
  if (failureCount >= FAILURE_THRESHOLD) {
    if (lastFailureTime && Date.now() - lastFailureTime < CIRCUIT_RESET_TIME) {
      circuitOpenUntil = Date.now() + CIRCUIT_RESET_TIME;
      return true;
    }
    // Reset circuit after reset time
    failureCount = 0;
    lastFailureTime = null;
    circuitOpenUntil = null;
  }
  return false;
};

// Retry with exponential backoff
const retry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = getBackoffDelay(attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should continue retrying
      if (attempt === maxRetries || 
          lastError.message.includes("authentication") ||
          lastError.message.includes("invalid number")) {
        throw lastError;
      }
      
      console.warn(`Retry attempt ${attempt + 1}/${maxRetries} failed:`, lastError);
    }
  }
  
  throw lastError || new Error("Maximum retries exceeded");
};

export const sendMessage = async ({ to, message }: SendMessageParams): Promise<SendMessageResponse> => {
  try {
    console.log(`Attempting to send WhatsApp message to ${to}`);
    
    // Check circuit breaker
    if (isCircuitOpen()) {
      const waitTime = Math.ceil(
        ((circuitOpenUntil || 0) - Date.now()) / 1000
      );
      return {
        success: false,
        message: "Service temporarily disabled",
        error: `Too many consecutive errors. Try again in ${waitTime} seconds.`,
        retryAfter: waitTime
      };
    }
    
    if (!to || !message) {
      throw new Error("Phone number and message are required");
    }
    
    const formattedTo = to.startsWith('+') ? to : `+${to}`;
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp`;
    
    return await retry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
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
        
        const responseText = await response.text();
        console.log(`Supabase function response: ${response.status}`, {
          statusText: response.statusText,
          responsePreview: responseText.substring(0, 200)
        });
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error("JSON parsing error:", e);
          throw new Error(`Invalid server response: ${responseText.substring(0, 500)}`);
        }
        
        if (!response.ok) {
          const errorDetails = data.error || data.details || responseText;
          const statusCode = response.status;
          
          if (statusCode === 429) {
            throw new Error("Rate limit reached. Please try again in a few minutes.");
          } else if (statusCode === 401 || statusCode === 403) {
            throw new Error("Authentication error. Please log in again.");
          } else if (statusCode >= 500) {
            failureCount++;
            lastFailureTime = Date.now();
            throw new Error("WhatsApp service is temporarily unavailable. Please try again later.");
          }
          
          throw new Error(`API Error (${statusCode}): ${errorDetails}`);
        }
        
        // Reset circuit breaker on success
        failureCount = 0;
        lastFailureTime = null;
        circuitOpenUntil = null;
        
        if (!data || typeof data !== 'object') {
          throw new Error("Invalid response format");
        }
        
        return {
          success: true,
          message: data.message || "Message sent successfully",
          sid: data.data?.messages?.[0]?.id
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error("Request timed out. Check your internet connection.");
        }
        
        const errorMessage = fetchError instanceof Error ? fetchError.message : "Unknown error";
        console.error("Detailed error:", {
          error: fetchError,
          message: errorMessage,
          timestamp: new Date().toISOString()
        });
        
        throw new Error(`Send failed: ${errorMessage}`);
      }
    }, 3);
    
  } catch (error) {
    console.error("Error in sendMessage:", {
      error,
      timestamp: new Date().toISOString(),
      context: { to, messageLength: message?.length }
    });
    
    let userMessage = "Failed to send message";
    let errorDetails = error instanceof Error ? error.message : "Unknown error";
    let retryAfter: number | undefined;
    
    if (errorDetails.includes("temporarily unavailable")) {
      userMessage = "WhatsApp service is temporarily unavailable. We'll retry automatically in a few minutes.";
      retryAfter = 300;
    } else if (errorDetails.includes("rate limit")) {
      userMessage = "Too many messages sent. Please wait a few minutes before trying again.";
      retryAfter = 180;
    } else if (errorDetails.includes("authentication")) {
      userMessage = "Your session has expired. Please log in again.";
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

export const verifyWhatsAppNumber = async (phoneNumber: string): Promise<boolean> => {
  try {
    const result = await sendMessage({
      to: phoneNumber,
      message: "Verifying WhatsApp number"
    });
    
    return result.success;
  } catch (error) {
    console.error('Error in verifyWhatsAppNumber:', error);
    return false;
  }
};

export const getUserWhatsAppNumber = (): string | null => {
  return localStorage.getItem('userWhatsAppNumber');
};

export const sendMessageToCurrentUser = async (message: string): Promise<SendMessageResponse> => {
  const phoneNumber = getUserWhatsAppNumber();
  
  if (!phoneNumber) {
    return {
      success: false,
      message: "WhatsApp number not configured",
      error: "WhatsApp number not configured. Please set up your number in settings."
    };
  }
  
  return sendMessage({
    to: phoneNumber,
    message
  });
};