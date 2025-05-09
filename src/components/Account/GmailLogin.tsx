import React, { useState } from 'react';
import { Mail, AlertCircle, Settings, CheckCircle2 } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

interface GmailLoginProps {
  onLoginSuccess: (accessToken: string) => void;
}

const GmailLogin: React.FC<GmailLoginProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPopupInstructions, setShowPopupInstructions] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const login = useGoogleLogin({
    flow: 'implicit',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels'
    ].join(' '),
    onSuccess: async (response) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${response.access_token}`,
          },
        });
        
        if (!result.ok) {
          throw new Error('Échec de la récupération des informations du compte');
        }

        const userInfo = await result.json();
        setUserEmail(userInfo.email);
        setIsConnected(true);
        onLoginSuccess(response.access_token);
        
      } catch (err) {
        setError("Échec de la récupération des informations du compte");
        console.error('Gmail login error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    onError: (errorResponse) => {
      console.error('Google login error:', errorResponse);
      setShowPopupInstructions(true);
      setError("La connexion à Gmail a échoué. Assurez-vous que les popups sont autorisés et réessayez.");
    },
  });

  const handleLogin = () => {
    setError(null);
    try {
      const testPopup = window.open('', '_blank', 'width=1,height=1');
      
      if (!testPopup || testPopup.closed || typeof testPopup.closed === 'undefined') {
        setShowPopupInstructions(true);
        setError("Les popups sont bloqués. Veuillez les autoriser pour ce site pour continuer.");
        return;
      }
      
      testPopup.close();
      login();
    } catch (err) {
      setShowPopupInstructions(true);
      setError("Impossible d'ouvrir la fenêtre de connexion. Veuillez autoriser les popups pour ce site.");
      console.error('Login initialization error:', err);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <div className="flex items-center mb-4">
        <Mail className="h-5 w-5 text-gray-500 mr-2" />
        <h3 className="text-sm font-medium">Connectez votre compte Gmail</h3>
      </div>
      
      {isConnected && (
        <div className="mb-4 p-4 bg-green-50 border border-green-100 rounded-md">
          <div className="flex items-start">
            <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <h4 className="font-medium text-green-800 mb-1">Compte connecté avec succès</h4>
              <p className="text-green-700">{userEmail}</p>
            </div>
          </div>
        </div>
      )}
      
      {showPopupInstructions && !isConnected && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-md">
          <div className="flex items-start">
            <Settings className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <h4 className="font-medium text-blue-800 mb-1">Autoriser les popups</h4>
              <ol className="list-decimal list-inside text-blue-700 space-y-1">
                <li>Cherchez l'icône de popup bloqué dans la barre d'adresse</li>
                <li>Cliquez sur l'icône et sélectionnez "Toujours autoriser les popups de ce site"</li>
                <li>Cliquez sur "Terminé" ou fermez les paramètres</li>
                <li>Essayez de vous connecter à nouveau</li>
              </ol>
            </div>
          </div>
        </div>
      )}
      
      {error && !isConnected && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-600">
            {error}
          </div>
        </div>
      )}
      
      {!isConnected && (
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Connexion en cours...
            </span>
          ) : (
            <span className="flex items-center">
              <Mail className="w-5 h-5 mr-2" />
              Se connecter avec Gmail
            </span>
          )}
        </button>
      )}
      
      {!isConnected && (
        <p className="mt-3 text-xs text-gray-500 text-center">
          Les popups doivent être autorisés pour se connecter avec Gmail
        </p>
      )}
    </div>
  );
};

export default GmailLogin;