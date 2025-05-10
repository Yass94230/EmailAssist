import React, { useState } from 'react';
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
  
  const supabase = useSupabaseClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        if (signInError.message === 'Invalid login credentials') {
          throw new Error('Email ou mot de passe incorrect. Veuillez vérifier vos informations.');
        } else if (signInError.message.includes('Email not confirmed')) {
          throw new Error('Veuillez confirmer votre email avant de vous connecter.');
        } else {
          throw new Error('Une erreur est survenue lors de la connexion. Veuillez réessayer.');
        }
      }

      if (data?.user) {
        console.log('Connexion réussie:', data.user.email);
        
        // Récupérer les informations utilisateur depuis Supabase
        const { data: userData, error: userError } = await supabase
          .from('user_whatsapp')
          .select('phone_number')
          .eq('user_id', data.user.id)
          .maybeSingle();
          
        if (!userError && userData?.phone_number) {
          // Si l'utilisateur a déjà un numéro WhatsApp enregistré
          localStorage.setItem('userWhatsAppNumber', userData.phone_number);
          localStorage.setItem('whatsapp_verified', 'true');
          console.log('Numéro WhatsApp trouvé dans la base de données:', userData.phone_number);
          
          // Redirection forcée vers le tableau de bord
          window.location.href = '/admin';
          return;
        }
        
        // Vérifier si le localStorage contient déjà des infos WhatsApp
        const savedNumber = localStorage.getItem('userWhatsAppNumber');
        const isVerified = localStorage.getItem('whatsapp_verified') === 'true';
        
        if (savedNumber && isVerified) {
          // Si WhatsApp est déjà configuré, rediriger vers le tableau de bord
          console.log('Redirection vers /admin (WhatsApp déjà configuré)');
          window.location.href = '/admin';
        } else {
          // Sinon, rediriger vers la page d'accueil pour configurer WhatsApp
          console.log('Redirection vers / (configuration WhatsApp requise)');
          window.location.href = '/';
        }
        
        // Appeler onSuccess
        onSuccess();
      } else {
        throw new Error('Une erreur inattendue est survenue. Veuillez réessayer.');
      }
    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la connexion');
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
      </div>
    </div>
  );
};

export default LoginForm;