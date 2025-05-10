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
    const response = await fetch(`${import.meta.env.VITE_API_URL}/claude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        ...options
      })
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    const data = await response.json();
    return {
      text: data.response,
      audioUrl: data.audio
    };
  } catch (error) {
    console.error('Error in generateResponse:', error);
    throw error;
  }
}