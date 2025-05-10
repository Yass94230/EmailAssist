import React, { useState, useEffect } from 'react';
import { Mail, AlertCircle, CheckCircle2, LogOut, RefreshCw } from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { getGmailTokens } from '../../services/gmail';
import Alert from '../ui/Alert';
import { Spinner } from '../ui/Spinner';

interface GmailOAuthManagerProps {
  phoneNumber: string;
}

const GmailOAuthManager: React.FC<GmailOAuthManagerProps> = ({ phoneNumber }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const supabase = useSupabaseClient();

  useEffect(() => {
    checkGmailConnection();
  }, [phoneNumber]);

  const checkGmailConnection = async () => {
    try {
      setIsLoading(true);
      console.log("Vérification de la connexion Gmail pour:", phoneNumber);
      
      const tokens = await getGmailTokens(phoneNumber);
      console.log("Résultat de la vérification des tokens:", tokens ? "Tokens trouvés" : "Aucun token trouvé");
      
      if (tokens) {
        setIsConnected(true);
        setUserEmail(tokens.email);
      } else {
        setIsConnected(false);
        setUserEmail(null);
      }
    } catch (error) {
      console.error('Erreur détaillée lors de la vérification de la connexion Gmail:', error);
      setError('Erreur lors de la vérification de la connexion Gmail. Détails: ' + 
               (error instanceof Error ? error.message : 'Erreur inconnue'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      setIsLoading(true);
      console.log("Tentative de connexion à Google pour le numéro:", phoneNumber);

      const { data, error: functionError } = await supabase
        .functions.invoke('google-auth-url', {
          body: { phoneNumber },
          headers: {
            'Content-Type': 'application/json'
          }
        });

      console.log("Réponse de la fonction google-auth-url:", data, functionError);

      if (functionError) {
        console.error("Erreur de la fonction Supabase:", functionError);
        throw new Error(functionError.message || 'Erreur lors de la connexion à Google');
      }
      
      if (data?.url) {
        console.log("URL d'autorisation générée:", data.url);
        
        // Vérifier si l'URL semble valide
        if (!data.url.includes('accounts.google.com')) {
          console.warn("L'URL générée ne semble pas être une URL Google OAuth valide");
        }
        
        // Redirection vers l'URL d'autorisation Google
        window.location.href = data.url;
      } else {
        console.error("Aucune URL retournée par la fonction", data);
        throw new Error('URL d\'autorisation invalide ou manquante');
      }
    } catch (error) {
      console.error('Erreur détaillée lors de la connexion Google:', error);
      
      // Message d'erreur plus descriptif
      const errorMessage = error instanceof Error 
        ? `Erreur lors de la connexion à Google: ${error.message}` 
        : 'Erreur inconnue lors de la connexion à Google';
      
      setError(errorMessage);
      setIsLoading(false);
      
      // Activer le bouton de nouvelle tentative
      setRetryCount(prev => prev + 1);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Êtes-vous sûr de vouloir déconnecter votre compte Gmail ?')) {
      return;
    }

    try {
      setIsLoading(true);
      console.log("Tentative de déconnexion du compte Gmail pour:", phoneNumber);
      
      const { error } = await supabase
        .from('gmail_credentials')
        .delete()
        .eq('phone_number', phoneNumber);

      if (error) {
        console.error("Erreur lors de la suppression des identifiants:", error);
        throw error;
      }

      console.log("Déconnexion réussie");
      setIsConnected(false);
      setUserEmail(null);
    } catch (error) {
      console.error('Erreur détaillée lors de la déconnexion:', error);
      setError('Erreur lors de la déconnexion: ' + 
               (error instanceof Error ? error.message : 'Erreur inconnue'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setIsRetrying(true);
    setError(null);
    
    // Vérifier à nouveau la configuration avant de réessayer
    console.log("Nouvelle tentative de connexion après échec...");
    setTimeout(() => {
      handleGoogleLogin();
      setIsRetrying(false);
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-center">
          <Spinner size="md" className="text-green-500" />
          <span className="ml-2 text-gray-600">Vérification de la connexion...</span>
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
          <div className="flex flex-col">
            <div className="font-medium">Erreur de connexion</div>
            <div className="text-sm">{error}</div>
            {retryCount > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                Assurez-vous que les cookies et les popups sont autorisés pour ce site.
              </div>
            )}
          </div>
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
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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

          <div className="flex flex-col space-y-3">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading || isRetrying}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-green-300 transition-colors"
            >
              {isLoading || isRetrying ? (
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

            {retryCount > 0 && !isRetrying && (
              <button
                onClick={handleRetry}
                className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Réessayer la connexion</span>
              </button>
            )}
          </div>

          {retryCount > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
              <h4 className="text-sm font-medium text-blue-800 mb-1">Conseils de dépannage:</h4>
              <ul className="list-disc pl-5 text-xs space-y-1 text-blue-700">
                <li>Vérifiez que les popups ne sont pas bloqués par votre navigateur</li>
                <li>Assurez-vous que les cookies tiers sont autorisés</li>
                <li>Si vous utilisez un bloqueur de publicités, désactivez-le temporairement</li>
                <li>Essayez dans un navigateur différent</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GmailOAuthManager;