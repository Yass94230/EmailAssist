import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Mail, Lock, UserPlus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';

interface RegisterFormProps {
  onSuccess: () => void;
  onBackToLogin: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = useSupabaseClient();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            email_confirmed: true // Auto-confirm email for direct access
          }
        }
      });

      if (signUpError) {
        if (signUpError.message === 'User already registered') {
          throw new Error('Un compte existe déjà avec cet email. Veuillez vous connecter.');
        }
        throw signUpError;
      }

      if (data?.user) {
        console.log('Inscription réussie:', data.user.email);
        
        // Create default user settings
        const { error: settingsError } = await supabase
          .from('user_settings')
          .insert({
            user_id: data.user.id,
            audio_enabled: true,
            voice_recognition_enabled: true,
            voice_type: 'alloy'
          });

        if (settingsError) {
          console.error('Error creating user settings:', settingsError);
        }

        // Appeler onSuccess
        onSuccess();
        
        // Rediriger vers le panneau d'administration
        console.log('Redirection vers /admin');
        navigate('/admin');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de l\'inscription';
      setError(errorMessage);
      
      if (errorMessage.includes('compte existe déjà')) {
        setTimeout(() => {
          const loginButton = document.querySelector('button[type="button"]');
          if (loginButton) {
            loginButton.classList.add('animate-pulse');
            setTimeout(() => loginButton.classList.remove('animate-pulse'), 2000);
          }
        }, 100);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-8">
          <div className="h-16 w-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Créer un compte</h2>
          <p className="text-gray-600 mt-2">Inscrivez-vous pour commencer</p>
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
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmer le mot de passe
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
              required
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
                Inscription...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <UserPlus className="h-5 w-5 mr-2" />
                S'inscrire
              </span>
            )}
          </Button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              Déjà un compte ? Se connecter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterForm;