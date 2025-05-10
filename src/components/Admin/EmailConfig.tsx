import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Mail, Trash2, Check, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { getGmailTokens } from '../../services/gmail';
import Alert from '../ui/Alert';
import { Spinner } from '../ui/Spinner';

interface EmailCredential {
  id: number;
  phone_number: string;
  email: string;
  provider: string;
  created_at: string;
}

const EmailConfig: React.FC = () => {
  const [credentials, setCredentials] = useState<EmailCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isGmailLoading, setIsGmailLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const supabase = useSupabaseClient();

  // Récupérer le numéro de téléphone de l'utilisateur
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  useEffect(() => {
    const savedNumber = localStorage.getItem('userWhatsAppNumber');
    if (savedNumber) {
      setPhoneNumber(savedNumber);
    }
    
    loadCredentials();
  }, []);

  useEffect(() => {
    if (phoneNumber) {
      checkGmailConnection();
    }
  }, [phoneNumber]);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_credentials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCredentials(data || []);
    } catch (err) {
      setError('Erreur lors du chargement des identifiants email');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkGmailConnection = async () => {
    try {
      setIsGmailLoading(true);
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
      setIsGmailLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ces identifiants ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_credentials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccess('Identifiants supprimés avec succès');
      loadCredentials();
      checkGmailConnection(); // Vérifier à nouveau la connexion après suppression

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur lors de la suppression des identifiants');
      console.error(err);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      setIsGmailLoading(true);
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
      setIsGmailLoading(false);
      
      // Activer le bouton de nouvelle tentative
      setRetryCount(prev => prev + 1);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Êtes-vous sûr de vouloir déconnecter ce compte Gmail ?')) {
      return;
    }

    try {
      setIsGmailLoading(true);
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
      setSuccess('Compte Gmail déconnecté avec succès');
      setIsConnected(false);
      setUserEmail(null);
      loadCredentials();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Erreur détaillée lors de la déconnexion:', error);
      setError('Erreur lors de la déconnexion: ' + 
               (error instanceof Error ? error.message : 'Erreur inconnue'));
    } finally {
      setIsGmailLoading(false);
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

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configuration Email</h1>

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

      {/* Section de connexion Gmail */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="h-6 w-6 text-green-500" />
          <h2 className="text-xl font-semibold">Connexion Gmail</h2>
        </div>

        {isGmailLoading ? (
          <div className="flex justify-center py-4">
            <Spinner size="md" className="text-green-500" />
            <span className="ml-2 text-gray-600">Traitement en cours...</span>
          </div>
        ) : (
          isConnected ? (
            <div>
              <div className="mb-4 p-4 bg-green-50 border border-green-100 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <p className="font-medium text-green-700">Compte Gmail connecté</p>
                </div>
                <p className="text-green-600 ml-7">{userEmail}</p>
              </div>

              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Déconnecter ce compte
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">
                Connectez votre compte Gmail pour gérer vos emails via WhatsApp.
              </p>

              <div className="flex flex-col space-y-3">
                <button
                  onClick={handleGoogleLogin}
                  disabled={isRetrying}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-green-300 transition-colors"
                >
                  {isRetrying ? (
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
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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
          )
        )}
      </div>

      {/* Liste des identifiants email */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-medium text-gray-700">Comptes Email Connectés</h3>
        </div>
        
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Numéro WhatsApp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fournisseur
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date de création
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {credentials.length > 0 ? (
              credentials.map((cred) => (
                <tr key={cred.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{cred.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cred.phone_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {cred.provider}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(cred.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDelete(cred.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  Aucun identifiant email enregistré
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmailConfig;