import React from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Volume2, Check, AlertCircle } from 'lucide-react';

interface AudioSetting {
  id: string;
  phone_number: string;
  audio_enabled: boolean;
  voice_type: string;
  created_at: string;
  updated_at: string;
}

const AudioConfig: React.FC = () => {
  const [settings, setSettings] = React.useState<AudioSetting[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const supabase = useSupabaseClient();

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSettings(data || []);
    } catch (err) {
      setError('Erreur lors du chargement des paramètres audio');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadSettings();
  }, []);

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

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configuration Audio</h1>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <Check className="h-5 w-5 text-green-500 mr-2" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Numéro WhatsApp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Audio Activé
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type de Voix
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dernière mise à jour
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {settings.map((setting) => (
              <tr key={setting.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Volume2 className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-900">{setting.phone_number}</span>
                  </div>
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
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
                  >
                    <option value="alloy">Alloy (Neutre)</option>
                    <option value="echo">Echo (Masculine)</option>
                    <option value="fable">Fable (Féminine)</option>
                    <option value="onyx">Onyx (Grave)</option>
                    <option value="nova">Nova (Douce)</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(setting.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {settings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
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