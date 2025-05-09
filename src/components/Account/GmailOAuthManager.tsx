import React, { useState, useEffect } from 'react';
import { Mail, AlertCircle, CheckCircle2, LogOut } from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { getGmailTokens } from '../../services/gmail';

interface GmailOAuthManagerProps {
  phoneNumber: string;
}

const GmailOAuthManager: React.FC<GmailOAuthManagerProps> = ({ phoneNumber }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = useSupabaseClient();

  useEffect(() => {
    checkGmailConnection();
  }, [phoneNumber]);

  useEffect(() => {
    // Check URL parameters for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const email = urlParams.get('email');
    const errorMsg = urlParams.get('error');

    if (success === 'true' && email) {
      setIsConnected(true);
      setUserEmail(email);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (errorMsg) {
      setError(decodeURIComponent(errorMsg));
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const checkGmailConnection = async () => {
    try {
      setIsLoading(true);
      const tokens = await getGmailTokens(phoneNumber);
      
      if (tokens) {
        setIsConnected(true);
        setUserEmail(tokens.email);
      } else {
        setIsConnected(false);
        setUserEmail(null);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de la connexion Gmail:', error);
      setError('Erreur lors de la vérification de la connexion Gmail');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      setIsLoading(true);

      // Get authorization URL from our backend
      const { data, error: urlError } = await supabase
        .functions.invoke('google-auth-url', {
          body: { phoneNumber }
        });

      if (urlError) throw urlError;
      
      if (data?.url) {
        // Open Google login in the same window
        window.location.href = data.url;
      } else {
        throw new Error('URL d\'autorisation invalide');
      }
    } catch (error) {
      console.error('Erreur lors de la connexion Google:', error);
      setError('Erreur lors de la connexion à Google');
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Êtes-vous sûr de vouloir déconnecter votre compte Gmail ?')) {
      return;
    }

    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('gmail_credentials')
        .delete()
        .eq('phone_number', phoneNumber);

      if (error) throw error;

      setIsConnected(false);
      setUserEmail(null);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      setError('Erreur lors de la déconnexion');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Mail className="h-6 w-6 text-green-500" />
        <h2 className="text-xl font-semibold">Gmail</h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isConnected ? (
        <div>
          <div className="mb-4 p-4 bg-green-50 border border-green-100 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <p className="font-medium text-green-700">Compte Gmail connecté</p>
            </div>
            <p className="text-green-600 ml-7">{userEmail}</p>
          </div>

          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Déconnecter le compte
          </button>

          <div className="mt-6 bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Commandes disponibles</h3>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-center gap-2">
                <span className="font-mono bg-gray-200 px-2 py-0.5 rounded text-sm">lire emails</span>
                <span>Lire vos emails récents</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono bg-gray-200 px-2 py-0.5 rounded text-sm">chercher [terme]</span>
                <span>Rechercher des emails</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono bg-gray-200 px-2 py-0.5 rounded text-sm">répondre</span>
                <span>Répondre à un email</span>
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-gray-600 mb-4">
            Connectez votre compte Gmail pour gérer vos emails via WhatsApp.
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-green-300 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Se connecter avec Gmail
          </button>
        </div>
      )}
    </div>
  );
};

export default GmailOAuthManager;