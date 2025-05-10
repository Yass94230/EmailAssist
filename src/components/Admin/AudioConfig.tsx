import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Volume2, Check, AlertCircle, VolumeX, Mic, Settings2, MessageSquare } from 'lucide-react';
import { Database } from '../../types/supabase';
import Alert from '../ui/Alert';
import { Spinner } from '../ui/Spinner';

interface AudioSetting {
  id: string;
  phone_number: string;
  audio_enabled: boolean;
  voice_recognition_enabled: boolean;
  voice_type: string;
  created_at: string;
  updated_at: string;
}

const AudioConfig: React.FC = () => {
  const [settings, setSettings] = useState<AudioSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPhoneNumber, setCurrentPhoneNumber] = useState<string>('');
  
  // Paramètres personnels
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [voiceRecognitionEnabled, setVoiceRecognitionEnabled] = useState(true);
  const [voiceType, setVoiceType] = useState('alloy');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const supabase = useSupabaseClient<Database>();

  useEffect(() => {
    // Récupérer le numéro de téléphone de l'utilisateur connecté
    const savedNumber = localStorage.getItem('userWhatsAppNumber');
    if (savedNumber) {
      setCurrentPhoneNumber(savedNumber);
    }
    
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Vérifier si la colonne voice_recognition_enabled existe, sinon la créer
      try {
        await checkAndCreateVoiceRecognitionColumn();
      } catch (columnError) {
        console.error("Erreur lors de la vérification/création de la colonne:", columnError);
        // Continuer même en cas d'erreur
      }
      
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSettings(data || []);
      
      // Charger les paramètres pour l'utilisateur actuel
      const savedNumber = localStorage.getItem('userWhatsAppNumber');
      if (savedNumber) {
        const userSettings = data?.find(setting => setting.phone_number === savedNumber);
        if (userSettings) {
          setAudioEnabled(userSettings.audio_enabled);
          // Défaut à true si la propriété n'existe pas
          setVoiceRecognitionEnabled(userSettings.voice_recognition_enabled ?? true);
          setVoiceType(userSettings.voice_type || 'alloy');
        }
      }
    } catch (err) {
      setError('Erreur lors du chargement des paramètres audio');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Vérifier si la colonne voice_recognition_enabled existe, sinon la créer
  const checkAndCreateVoiceRecognitionColumn = async () => {
    try {
      // Vérifier d'abord si la colonne existe en récupérant un enregistrement
      const { data, error } = await supabase
        .from('user_settings')
        .select('voice_recognition_enabled')
        .limit(1);
      
      // Si pas d'erreur, la colonne existe déjà
      if (!error) return;
      
      // Si l'erreur indique que la colonne n'existe pas, on la crée
      if (error.message.includes('column "voice_recognition_enabled" does not exist')) {
        console.log("La colonne voice_recognition_enabled n'existe pas, création...");
        
        // Utiliser une requête SQL pour ajouter la colonne
        // Note: Ceci nécessite des privilèges élevés
        const { error: alterError } = await supabase.rpc('add_voice_recognition_column');
        
        if (alterError) {
          console.error("Erreur lors de la création de la colonne:", alterError);
          throw alterError;
        }
        
        console.log("Colonne voice_recognition_enabled créée avec succès");
      } else {
        // Une autre erreur est survenue
        throw error;
      }
    } catch (error) {
      console.error("Erreur lors de la vérification/création de la colonne:", error);
      throw error;
    }
  };

  const handleToggleAudio = async (setting: AudioSetting) => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ 
          audio_enabled: !setting.audio_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', setting.id);

      if (error) throw error;

      setSuccess('Paramètres audio mis à jour avec succès');
      loadSettings();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de la mise à jour des paramètres');
      console.error(err);
    }
  };

  const handleToggleVoiceRecognition = async (setting: AudioSetting) => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ 
          voice_recognition_enabled: !setting.voice_recognition_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', setting.id);

      if (error) throw error;

      setSuccess('Paramètres de reconnaissance vocale mis à jour avec succès');
      loadSettings();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de la mise à jour des paramètres');
      console.error(err);
    }
  };

  const handleVoiceTypeChange = async (setting: AudioSetting, voiceType: string) => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ 
          voice_type: voiceType,
          updated_at: new Date().toISOString()
        })
        .eq('id', setting.id);

      if (error) throw error;

      setSuccess('Type de voix mis à jour avec succès');
      loadSettings();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de la mise à jour du type de voix');
      console.error(err);
    }
  };
  
  const saveUserSettings = async () => {
    if (!currentPhoneNumber) {
      setError('Numéro de téléphone non disponible');
      return;
    }
    
    try {
      setIsUpdating(true);
      setError(null);
      setSuccess(null);
  
      // Vérifier si l'utilisateur a déjà des paramètres
      const { data: existingSettings, error: fetchError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('phone_number', currentPhoneNumber)
        .maybeSingle();
  
      if (fetchError) throw fetchError;
  
      // Mise à jour des paramètres existants ou création de nouveaux paramètres
      const { data: { user } } = await supabase.auth.getUser();
      
      if (existingSettings) {
        // Mise à jour
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({ 
            audio_enabled: audioEnabled,
            voice_recognition_enabled: voiceRecognitionEnabled,
            voice_type: voiceType,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSettings.id);
  
        if (updateError) throw updateError;
      } else {
        // Création
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            phone_number: currentPhoneNumber,
            user_id: user?.id,
            audio_enabled: audioEnabled,
            voice_recognition_enabled: voiceRecognitionEnabled,
            voice_type: voiceType
          });
  
        if (insertError) throw insertError;
      }
  
      setSuccess('Paramètres audio mis à jour avec succès');
      loadSettings();
  
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de la mise à jour des paramètres');
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Paramètres Audio</h1>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="mb-4">
          {success}
        </Alert>
      )}

      {/* Paramètres audio personnels */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings2 className="h-6 w-6 text-purple-500" />
          <h2 className="text-xl font-semibold">Mes Paramètres Audio</h2>
        </div>
        
        <div className="space-y-6">
          {/* Paramètres de reconnaissance vocale */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-gray-600" />
                <span className="font-medium">Reconnaissance vocale</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceRecognitionEnabled}
                  onChange={(e) => setVoiceRecognitionEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
            <p className="mt-1 text-sm text-gray-500 ml-7">
              Activer la reconnaissance vocale pour comprendre vos messages audio
            </p>
          </div>

          {/* Paramètres de réponse audio */}
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
                <MessageSquare className="h-5 w-5 text-gray-600" />
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
          
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-800 mb-2">Fonctionnalités audio</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2">
                <Mic className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
                <span>Envoyez des messages vocaux via WhatsApp et Claude les comprendra</span>
              </li>
              <li className="flex gap-2">
                <Volume2 className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
                <span>Recevez les réponses sous forme d'audio avec la voix de votre choix</span>
              </li>
              <li className="flex gap-2">
                <MessageSquare className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
                <span>Communication bidirectionnelle en audio pour une expérience plus naturelle</span>
              </li>
            </ul>
          </div>
          
          <button
            onClick={saveUserSettings}
            disabled={isUpdating}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-purple-300 transition-colors"
          >
            {isUpdating ? (
              <>
                <Spinner size="sm" className="text-white" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <span>Enregistrer mes paramètres</span>
            )}
          </button>
        </div>
      </div>

      {/* Tableau des paramètres de tous les utilisateurs */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-medium text-gray-700">Configuration Audio des Utilisateurs</h3>
        </div>
        
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Numéro WhatsApp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reconnaissance Vocale
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Réponses Audio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type de Voix
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {settings.length > 0 ? (
              settings.map((setting) => (
                <tr key={setting.id} className={currentPhoneNumber === setting.phone_number ? "bg-purple-50" : ""}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Volume2 className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{setting.phone_number}</span>
                      {currentPhoneNumber === setting.phone_number && (
                        <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                          Vous
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setting.voice_recognition_enabled ?? true}
                        onChange={() => handleToggleVoiceRecognition(setting)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setting.audio_enabled}
                        onChange={() => handleToggleAudio(setting)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={setting.voice_type}
                      onChange={(e) => handleVoiceTypeChange(setting, e.target.value)}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm rounded-md"
                    >
                      <option value="alloy">Alloy (Neutre)</option>
                      <option value="echo">Echo (Masculine)</option>
                      <option value="fable">Fable (Féminine)</option>
                      <option value="onyx">Onyx (Grave)</option>
                      <option value="nova">Nova (Douce)</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                    <button
                      onClick={() => handleToggleVoiceRecognition(setting)}
                      className="text-purple-600 hover:text-purple-900"
                      title={setting.voice_recognition_enabled ? "Désactiver la reconnaissance vocale" : "Activer la reconnaissance vocale"}
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleToggleAudio(setting)}
                      className="text-green-600 hover:text-green-900"
                      title={setting.audio_enabled ? "Désactiver les réponses audio" : "Activer les réponses audio"}
                    >
                      {setting.audio_enabled ? (
                        <Volume2 className="h-5 w-5" />
                      ) : (
                        <VolumeX className="h-5 w-5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  Aucun paramètre audio enregistré
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AudioConfig;