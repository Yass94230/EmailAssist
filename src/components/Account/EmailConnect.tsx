import React, { useState, useEffect } from 'react';
import { Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

const EmailConnect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const supabase = useSupabaseClient();

  const sessionId = searchParams.get('id');

  useEffect(() => {
    if (!sessionId) {
      setError('ID de session manquant');
      setIsLoading(false);
      return;
    }

    validateSession();
  }, [sessionId]);

  const validateSession = async () => {
    try {
      const { data, error } = await supabase
        .from('email_connection_sessions')
        .select('status, expires_at')
        .eq('session_id', sessionId)
        .single();

      if (error) throw error;

      if (!data) {
        setError('Session invalide');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError('Session expirée');
        return;
      }

      if (data.status !== 'pending') {
        setError('Cette session a déjà été utilisée');
        return;
      }
    } catch (err) {
      console.error('Erreur lors de la validation de la session:', err);
      setError('Erreur lors de la validation de la session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Tester la connexion email
      const { error: testError } = await supabase.functions.invoke('test-email-connection', {
        body: { email, password }
      });

      if (testError) throw testError;

      // Sauvegarder les identifiants
      const { error: saveError } = await supabase
        .from('email_credentials')
        .insert({
          session_id: sessionId,
          email,
          provider: email.endsWith('@gmail.com') ? 'gmail' : 'other',
          config: {
            password: password // Note: Le mot de passe sera chiffré côté serveur
          }
        });

      if (saveError) throw saveError;

      // Marquer la session comme complétée
      await supabase
        .from('email_connection_sessions')
        .update({ status: 'completed' })
        .eq('session_id', sessionId);

      setSuccess(true);
    } catch (err) {
      console.error('Erreur lors de la connexion:', err);
      setError('Erreur lors de la connexion. Vérifiez vos identifiants.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-center text-red-500 mb-4">
            <AlertCircle size={48} />
          </div>
          <h2 className="text-xl font-bold text-center text-gray-800 mb-2">
            Erreur
          </h2>
          <p className="text-center text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-center text-green-500 mb-4">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-xl font-bold text-center text-gray-800 mb-2">
            Connexion réussie !
          </h2>
          <p className="text-center text-gray-600">
            Vous pouvez maintenant fermer cette fenêtre et retourner sur WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <div className="h-16 w-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Connexion Email</h2>
          <p className="text-gray-600 mt-2">
            Connectez votre compte email pour recevoir et gérer vos emails via WhatsApp
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Adresse email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Pour Gmail, utilisez un mot de passe d'application
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors disabled:bg-green-300"
          >
            {isLoading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmailConnect;