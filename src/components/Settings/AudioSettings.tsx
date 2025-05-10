import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Mic, Settings2 } from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AudioSettingsProps {
  phoneNumber: string;
}

const AudioSettings: React.FC<AudioSettingsProps> = ({ phoneNumber }) => {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [voiceType, setVoiceType] = useState('alloy');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const supabase = useSupabaseClient<SupabaseClient>();
  
  useEffect(() => {
    if (phoneNumber) {
      loadSettings();
    }
  }, [phoneNumber]);
  
  const loadSettings = async () => {
    if (!phoneNumber) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('audio_enabled, voice_type')
        .eq('phone_number', phoneNumber)
        .single();
        
      if (error) {
        if (error.code !== 'PGRST116') { // Pas de résultat trouvé
          throw error;
        }
      }
      
      if (data) {
        setAudioEnabled(data.audio_enabled === true);
        if (data.voice_type && typeof data.voice_type === 'string') {
          setVoiceType(data.voice_type);
        } else {
          setVoiceType('alloy'); // Valeur par défaut
        }
      }
    } catch (err) {
      console.error('Erreur lors du chargement des paramètres:', err);
      setError('Erreur lors du chargement des paramètres audio. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const saveSettings = async () => {
    if (!phoneNumber) return;
    
    setError('');
    setSuccess('');
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          phone_number: phoneNumber,
          audio_enabled: audioEnabled,
          voice_type: voiceType,
          updated_at: new Date().toISOString()
        }, { onConflict: 'phone_number' });
        
      if (error) throw error;
      
      setSuccess('Paramètres audio enregistrés avec succès');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erreur lors de l\'enregistrement des paramètres audio. Veuillez réessayer.');
      console.error('Erreur lors de l\'enregistrement des paramètres:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings2 className="h-6 w-6 text-purple-500" />
        <h2 className="text-xl font-semibold">Paramètres Audio</h2>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
              {success}
            </div>
          )}
          
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {audioEnabled ? (
                    <Volume2 className="h-5 w-5 text-gray-600" />
                  ) : (
                    <VolumeX className="h-5 w-5 text-gray-400" />
                  )}
                  <span className="font-medium">Réponses Audio</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={audioEnabled}
                    onChange={(e) => setAudioEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              <p className="mt-1 text-sm text-gray-500 ml-7">
                Recevoir les réponses de l'assistant en format audio
              </p>
            </div>

            {audioEnabled && (
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <Mic className="h-5 w-5 text-gray-600" />
                  <span className="font-medium">Type de Voix</span>
                </label>
                <select
                  value={voiceType}
                  onChange={(e) => setVoiceType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="alloy">Alloy (Neutre)</option>
                  <option value="echo">Echo (Masculine)</option>
                  <option value="fable">Fable (Féminine)</option>
                  <option value="onyx">Onyx (Grave)</option>
                  <option value="nova">Nova (Douce)</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Choisissez la voix pour les réponses audio
                </p>
              </div>
            )}
            
            <button
              onClick={saveSettings}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-purple-300 transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                  <span>Enregistrement...</span>
                </>
              ) : (
                <span>Enregistrer les paramètres</span>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AudioSettings;