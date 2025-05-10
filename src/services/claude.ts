import { createClient } from '@supabase/supabase-js';

interface GenerateResponseOptions {
  generateAudio?: boolean;
  voiceType?: string;
  phoneNumber?: string;
  isAudioInput?: boolean;
  audioData?: string;
}

interface GenerateResponseResult {
  text: string;
  audioUrl?: string;
}

export async function generateResponse(
  prompt: string,
  options: GenerateResponseOptions = {}
): Promise<GenerateResponseResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }

  try {
    const payload: any = {
      prompt,
      generateAudio: options.generateAudio,
      voiceType: options.voiceType,
      phoneNumber: options.phoneNumber
    };

    // Si l'entrée est un audio, ajouter les données audio
    if (options.isAudioInput && options.audioData) {
      payload.isAudioInput = true;
      payload.audioData = options.audioData;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/claude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    const result: GenerateResponseResult = {
      text: data.response
    };

    if (data.audio) {
      result.audioUrl = `data:audio/mp3;base64,${data.audio}`;
    }

    return result;
  } catch (error) {
    console.error('Error calling Claude service:', error);
    throw error;
  }
}