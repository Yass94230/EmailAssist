import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Mail, AlertCircle, CheckCircle2, Key } from 'lucide-react';

interface GmailCredentialsManagerProps {
  phoneNumber: string;
}

const GmailCredentialsManager: React.FC<GmailCredentialsManagerProps> = ({ phoneNumber }) => {
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [savedEmail, setSavedEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const supabase = useSupabaseClient();
  
  useEffect(() => {
    if (phoneNumber) {
      fetchCredentials();
    }
  }, [phoneNumber]);
  
  const fetchCredentials = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase
        .from('gmail_credentials')
        .select('email')
        .eq('phone_number', phoneNumber)
        .single();
      
      if (error) {
        if (error.code !== 'PGRST116') { // No rows found
          throw error;
        }
      }
      
      if (data) {
        setHasCredentials(true);
        setSavedEmail(data.email);
        setEmail(data.email);
      } else {
        setHasCredentials(false);
        setSavedEmail('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la récupération des identifiants');
      console.error('Erreur:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isGoogleEmail = (email: string): boolean => {
    const lowercaseEmail = email.toLowerCase();
    if (lowercaseEmail.endsWith('@gmail.com') || lowercaseEmail.endsWith('@googlemail.com')) {
      return true;
    }
    
    try {
      const domain = lowercaseEmail.split('@')[1];
      return true;
    } catch {
      return false;
    }
  };
  
  const saveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!email || !appPassword) {
      setError('Tous les champs sont obligatoires');
      return;
    }
    
    if (!isGoogleEmail(email)) {
      setError('Veuillez entrer une adresse email Google valide (Gmail ou Google Workspace)');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('gmail_credentials')
        .upsert({
          phone_number: phoneNumber,
          email,
          app_password: appPassword,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'phone_number' });
      
      if (error) throw error;
      
      setSuccess('Identifiants Google enregistrés avec succès');
      setHasCredentials(true);
      setSavedEmail(email);
      setAppPassword('');
      
      setTimeout(() => {
        fetchCredentials();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement des identifiants');
      console.error('Erreur:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const deleteCredentials = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer vos identifiants ? Vous ne pourrez plus accéder à vos emails via WhatsApp.")) {
      return;
    }
    
    setError('');
    setSuccess('');
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('gmail_credentials')
        .delete()
        .eq('phone_number', phoneNumber);
      
      if (error) throw error;
      
      setSuccess('Identifiants supprimés avec succès');
      setHasCredentials(false);
      setSavedEmail('');
      setEmail('');
      setAppPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression des identifiants');
      console.error('Erreur:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Mail className="h-6 w-6 text-blue-500" />
        <h2 className="text-xl font-semibold">Configuration Google Mail</h2>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}
          
          {hasCredentials ? (
            <div>
              <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-500" />
                  <p className="font-medium text-blue-700">Compte Google connecté</p>
                </div>
                <p className="text-blue-600 ml-7">{savedEmail}</p>
              </div>
              
              <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => setHasCredentials(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Key className="h-4 w-4" />
                  Modifier les identifiants
                </button>
                
                <button 
                  onClick={deleteCredentials}
                  className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Supprimer la connexion
                </button>
              </div>
              
              <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Commandes WhatsApp disponibles</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="font-mono bg-gray-200 px-2 py-0.5 rounded text-sm">liste emails</span>
                    <span>Voir vos emails récents</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-mono bg-gray-200 px-2 py-0.5 rounded text-sm">chercher [terme]</span>
                    <span>Rechercher des emails</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <form onSubmit={saveCredentials}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                  Adresse email Google
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="exemple@votredomaine.com"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Adresse Gmail ou Google Workspace (ex: @gmail.com ou votre domaine personnalisé)
                </p>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="appPassword">
                  Mot de passe d'application
                </label>
                <input
                  id="appPassword"
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••••••••••"
                />
                <p className="mt-1 text-sm text-gray-500">
                  <a 
                    href="https://myaccount.google.com/apppasswords" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600"
                  >
                    Créer un mot de passe d'application →
                  </a>
                </p>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-amber-800 mb-2">Important</h3>
                <ol className="list-decimal list-inside space-y-1 text-amber-700">
                  <li>Activez l'authentification à deux facteurs sur votre compte Google</li>
                  <li>Créez un mot de passe d'application spécifique pour notre service</li>
                  <li>Autorisez l'accès IMAP dans les paramètres de messagerie</li>
                  <li>Pour Google Workspace : vérifiez les autorisations avec votre administrateur</li>
                </ol>
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" />
                    <span>Enregistrer les identifiants</span>
                  </>
                )}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
};

export default GmailCredentialsManager;