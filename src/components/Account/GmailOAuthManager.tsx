import React, { useState, useEffect } from 'react';
import { Mail, AlertCircle, CheckCircle2, LogOut } from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { getGmailTokens } from '../../services/gmail';
import Alert from '../ui/Alert';
import Spinner from '../ui/Spinner';

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

      const { data, error: functionError } = await supabase
        .functions.invoke('google-auth-url', {
          body: { phoneNumber },
          headers: {
            'Content-Type': 'application/json'
          }
        });

      if (functionError) {
        throw new Error(functionError.message || 'Erreur lors de la connexion à Google');
      }
      
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL d\'autorisation invalide');
      }
    } catch (error) {
      console.error('Erreur lors de la connexion Google:', error);
      setError('Erreur lors de la connexion à Google. Veuillez réessayer plus tard.');
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
          <Spinner size="md" className="text-green-500" />
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
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
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
            {isLoading ? (
              <>
                <Spinner size="sm" className="text-white" />
                <span>Connexion en cours...</span>
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                <span>Se connecter avec Gmail</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default GmailOAuthManager;