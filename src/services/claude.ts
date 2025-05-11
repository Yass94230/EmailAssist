import { createClient } from '@supabase/supabase-js';

interface GenerateResponseOptions {
  generateAudio?: boolean;
  voiceType?: string;
  phoneNumber: string;
  isAudioInput?: boolean;
  audioData?: string;
}

interface GenerateResponseResult {
  text: string;
  audioUrl?: string;
}

export async function generateResponse(
  prompt: string,
  options: GenerateResponseOptions
): Promise<GenerateResponseResult> {
  try {
    // Use Supabase Functions URL instead of custom API URL
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        ...options
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || 
        `Error ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    return {
      text: data.response,
      audioUrl: data.audio
    };
  } catch (error) {
    console.error('Error in generateResponse:', error);
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'Une erreur est survenue lors de la génération de la réponse'
    );
  }
}