import { createClient } from '@supabase/supabase-js';

interface GenerateResponseOptions {
  generateAudio?: boolean;
  voiceType?: string;
  phoneNumber: string;
  isAudioInput?: boolean;
  audioData?: string;
  mimeType?: string;
}

interface GenerateResponseResult {
  text: string;
  audioUrl?: string;
}

// Maximum audio size (10MB in base64)
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;

// Supported audio MIME types
const SUPPORTED_MIME_TYPES = [
  'audio/webm',
  'audio/mp3',
  'audio/wav',
  'audio/mpeg',
  'audio/ogg'
];

// Validate audio MIME type
function isValidMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType.toLowerCase());
}

// Validate audio data
function isValidAudioData(data: string, mimeType?: string): boolean {
  try {
    if (!data || data.length < 100) {
      console.warn("Audio data too short or empty");
      return false;
    }

    if (mimeType && !isValidMimeType(mimeType)) {
      console.warn(`Unsupported MIME type: ${mimeType}`);
      return false;
    }

    const base64Regex = /^[A-Za-z0-9+/]*={0,3}$/;
    const isBase64Valid = base64Regex.test(data);
    
    if (!isBase64Valid) {
      console.warn("Invalid base64 format");
      return false;
    }

    const estimatedSize = Math.ceil(data.length * 0.75);
    if (estimatedSize > MAX_AUDIO_SIZE) {
      console.warn("Audio file too large:", estimatedSize, "bytes");
      return false;
    }

    return true;
  } catch (e) {
    console.error('Error validating audio:', e);
    return false;
  }
}

export async function generateResponse(
  prompt: string,
  options: GenerateResponseOptions
): Promise<GenerateResponseResult> {
  try {
    console.log("Generating Claude response with parameters:", {
      promptLength: prompt.length,
      isAudioInput: options.isAudioInput,
      hasAudio: !!options.audioData,
      audioSize: options.audioData ? `${Math.floor(options.audioData.length / 1000)}KB` : 'N/A',
      generateAudio: options.generateAudio,
      voiceType: options.voiceType,
      mimeType: options.mimeType || 'not specified'
    });

    if (options.isAudioInput) {
      if (!options.audioData) {
        throw new Error("Audio data required for audio processing");
      }

      if (!options.mimeType) {
        throw new Error("MIME type must be specified for audio processing");
      }

      if (!isValidMimeType(options.mimeType)) {
        throw new Error(`Unsupported audio format. Please use one of: ${SUPPORTED_MIME_TYPES.join(', ')}`);
      }

      if (!isValidAudioData(options.audioData, options.mimeType)) {
        throw new Error("Invalid audio data or format");
      }
    }

    const requestBody = {
      prompt,
      phoneNumber: options.phoneNumber,
      generateAudio: options.generateAudio || false,
      voiceType: options.voiceType || 'alloy',
      isAudioInput: options.isAudioInput || false,
      audioData: options.audioData ? options.audioData.trim() : undefined,
      mimeType: options.mimeType
    };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration (URL or API key)");
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/claude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: errorText };
      }
      
      console.error("Claude API error response:", {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      
      switch (response.status) {
        case 400:
          if (options.isAudioInput) {
            throw new Error(`Invalid audio format. Supported formats: ${SUPPORTED_MIME_TYPES.join(', ')}`);
          }
          throw new Error("Invalid request format");
        case 413:
          throw new Error("Audio file too large (maximum 10MB)");
        case 429:
          throw new Error("Too many requests. Please try again in a few moments");
        case 500:
          throw new Error("Server error during audio processing. Please try again");
        default:
          throw new Error(
            errorData?.error || errorData?.details || 
            `Error ${response.status}: ${response.statusText}`
          );
      }
    }

    const data = await response.json();
    
    if (!data || typeof data.response !== 'string') {
      console.error("Invalid response structure:", data);
      throw new Error("Invalid server response");
    }

    return {
      text: data.response,
      audioUrl: data.audio
    };
  } catch (error) {
    console.error('Detailed error in generateResponse:', error);
    
    let errorMessage = "An error occurred while generating the response";
    
    if (error instanceof Error) {
      if (error.message.includes("413") || error.message.includes("too large")) {
        errorMessage = "Audio message is too large. Please record a shorter message.";
      } else if (error.message.includes("429") || error.message.includes("too many requests")) {
        errorMessage = "Too many requests. Please try again in a few moments.";
      } else if (error.message.includes("401") || error.message.includes("403")) {
        errorMessage = "Authentication problem with Claude service. Please log in again.";
      } else if (error.message.includes("format") || error.message.includes("supported")) {
        errorMessage = `Unsupported audio format. Please use one of: ${SUPPORTED_MIME_TYPES.join(', ')}`;
      } else {
        errorMessage = error.message;
      }
    }
    
    throw new Error(errorMessage);
  }
}