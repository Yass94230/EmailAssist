import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Mail, AlertCircle, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import Alert from '../ui/Alert';
import { Button } from '../ui/Button';
import { checkEmailConnectionStatus } from '../../services/email';

interface EmailConnectProps {
  isLoading?: boolean;
}

const EmailConnect: React.FC<EmailConnectProps> = ({ isLoading: initialLoading = false }) => {
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  
  // Récupérer l'ID de session depuis l'URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get('id');
    
    if (id) {
      setSessionId(id);
      checkSessionStatus(id);
    } else {
      setError("ID de session manquant. Veuillez demander un nouveau lien de connexion.");
    }
  }, [location]);
  
  // Vérifier le statut de la session
  const checkSessionStatus = async (id: string) => {
    try {
      setIsLoading(true);
      console.log("Vérification du statut de la session:", id);
      
      const sessionStatus = await checkEmailConnectionStatus(id);
      
      if (!sessionStatus) {
        console.error("Session non trouvée ou expirée");
        setError("Session non trouvée ou expirée. Veuillez demander un nouveau lien de connexion.");
        setStatus("expired");
        return;
      }
      
      console.log("Statut de la session:", sessionStatus.status);
      setStatus(sessionStatus.status);
      
      if (sessionStatus.status === 'completed') {
        setSuccess("Votre compte email a été connecté avec succès !");
      } else if (sessionStatus.status === 'failed') {
        setError("La connexion a échoué. Veuillez réessayer.");
      }
    } catch (err) {
      console.error("Erreur lors de la vérification du statut:", err);
      setError("Erreur lors de la vérification du statut de la connexion. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Gérer la connexion Google
  const handleGoogleConnect = async () => {
    if (!sessionId) {
      setError("ID de session manquant. Veuillez demander un nouveau lien de connexion.");
      return;
    }
    
    try {
      setIsLoading(true);
      console.log("Redirection vers la page d'authentification Google");
      
      const { data, error } = await supabase.functions.invoke('google-auth-url', {
        body: { sessionId },
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (error) {
        console.error("Erreur lors de la génération de l'URL Google:", error);
        throw new Error(error.message || "Erreur lors de la connexion à Google");
      }
      
      if (data?.url) {
        // Redirection vers l'URL d'authentification Google
        window.location.href = data.url;
      } else {
        throw new Error("URL d'authentification invalide ou manquante");
      }
    } catch (err) {
      console.error("Erreur détaillée:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue lors de la connexion");
      setIsLoading(false);
    }
  };
  
  // Retourner à l'application
  const handleReturnToApp = () => {
    navigate('/');
  };
  
  // Afficher un chargement
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Spinner size="lg" className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Traitement en cours</h2>
          <p className="text-gray-600">Veuillez patienter pendant que nous traitons votre demande...</p>
        </div>
      </div>
    );
  }
  
  // Afficher une erreur
  if (error || status === 'expired' || status === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Connexion échouée</h2>
            <p className="text-gray-600 mt-2">{error || "Une erreur s'est produite lors de la connexion"}</p>
          </div>
          
          <div className="flex justify-center">
            <Button
              onClick={handleReturnToApp}
              className="flex items-center"
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retourner à l'application
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Afficher un succès
  if (success || status === 'completed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Connexion réussie</h2>
            <p className="text-gray-600 mt-2">Votre compte email a été connecté avec succès !</p>
          </div>
          
          <div className="flex justify-center">
            <Button
              onClick={handleReturnToApp}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retourner à l'application
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Afficher la page de connexion par défaut
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="h-16 w-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Connexion Email</h2>
          <p className="text-gray-600 mt-2">Choisissez votre fournisseur de messagerie pour continuer</p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={handleGoogleConnect}
            className="w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4.67676C13.6 4.67676 14.9 5.27676 15.9 6.17676L19.1 3.07676C17.2 1.27676 14.8 0.176758 12 0.176758C7.4 0.176758 3.5 2.97676 1.6 6.97676L5.3 9.77676C6.3 6.77676 8.9 4.67676 12 4.67676Z" fill="#EA4335"/>
              <path d="M23.5 12.1768C23.5 11.1768 23.4 10.3768 23.3 9.57676H12V13.9768H18.5C18.2 15.3768 17.3 16.6768 16 17.4768L19.6 20.1768C21.8 18.1768 23.5 15.3768 23.5 12.1768Z" fill="#4285F4"/>
              <path d="M5.3 14.3768C5 13.6768 4.9 12.9768 4.9 12.1768C4.9 11.3768 5.1 10.6768 5.3 9.97676L1.6 7.17676C0.9 8.67676 0.5 10.3768 0.5 12.1768C0.5 13.9768 0.9 15.6768 1.6 17.1768L5.3 14.3768Z" fill="#FBBC05"/>
              <path d="M12 23.8768C14.8 23.8768 17.1 22.8768 19 20.9768L15.4 18.2768C14.4 18.9768 13.3 19.3768 12 19.3768C9 19.3768 6.4 17.2768 5.3 14.3768L1.6 17.1768C3.4 21.1768 7.4 23.8768 12 23.8768Z" fill="#34A853"/>
            </svg>
            Se connecter avec Google
          </button>
          
          <button
            onClick={handleReturnToApp}
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-500 hover:bg-red-600 focus:outline-none"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Annuler et retourner à l'application
          </button>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            Ce lien de connexion est valable pendant 24 heures et ne peut être utilisé qu'une seule fois.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailConnect;