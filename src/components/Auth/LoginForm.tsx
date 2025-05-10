// Modification du LoginForm.tsx avec plus de débogage
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Mail, Lock, LogIn } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';

interface LoginFormProps {
  onSuccess: () => void;
  onRegister: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  
  const supabase = useSupabaseClient();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDebugInfo("Tentative de connexion...");
    setIsLoading(true);

    try {
      console.log("Tentative de connexion avec:", { email });
      
      // Utilisation de la méthode native de Supabase pour la connexion
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      console.log("Réponse de Supabase:", { data, error: signInError });
      setDebugInfo(`Réponse: ${JSON.stringify({ data: data ? "Données reçues" : "Pas de données", error: signInError }, null, 2)}`);

      if (signInError) {
        console.error("Erreur Supabase:", signInError);
        
        // Messages d'erreur plus détaillés et informatifs
        if (signInError.message === 'Invalid login credentials') {
          throw new Error('Email ou mot de passe incorrect. Veuillez vérifier vos informations.');
        } else if (signInError.message.includes('Email not confirmed')) {
          throw new Error('Veuillez confirmer votre email avant de vous connecter.');
        } else {
          throw new Error(`Erreur de connexion: ${signInError.message}`);
        }
      }

      if (data?.user) {
        console.log('Connexion réussie:', data.user.email);
        setDebugInfo("Connexion réussie, préparation de la redirection...");
        
        // Stocker des informations utilisateur importantes
        if (data.user.phone) {
          localStorage.setItem('userWhatsAppNumber', data.user.phone);
        }
        
        // Informer le parent
        onSuccess();
        
        // Temporiser légèrement avant de rediriger
        setTimeout(() => {
          console.log("Redirection vers /admin");
          navigate('/admin');
        }, 500);
      } else {
        setDebugInfo("Données utilisateur vides, problème de session");
        throw new Error('Session utilisateur introuvable. Veuillez réessayer.');
      }
    } catch (err) {
      console.error('Erreur détaillée de connexion:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la connexion');
      setDebugInfo(`Erreur: ${err instanceof Error ? err.stack : 'Erreur inconnue'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-8">
          <div className="h-16 w-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Assistant Email</h2>
          <p className="text-gray-600 mt-2">Connectez-vous pour continuer</p>
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              leftIcon={<Mail className="h-5 w-5 text-gray-400" />}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
              required
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                Connexion...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <LogIn className="h-5 w-5 mr-2" />
                Se connecter
              </span>
            )}
          </Button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={onRegister}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Pas encore de compte ? S'inscrire
            </button>
          </div>
        </form>

        {/* Zone de débogage (à supprimer en production) */}
        {debugInfo && (
          <div className="mt-4 p-3 bg-gray-100 rounded-md text-xs text-gray-700 overflow-auto max-h-40">
            <pre>{debugInfo}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginForm;