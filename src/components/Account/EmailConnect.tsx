import React, { useState, useEffect } from 'react';
import { Mail, AlertCircle, CheckCircle2 } from 'lucide-react';

interface EmailConnectProps {
  sessionId: string;
  onSuccess: (email: string) => void;
}

// Map des fournisseurs email connus
const emailProviderMap = {
  'gmail.com': {
    name: 'Google',
    type: 'oauth',
    icon: 'google'
  },
  'googlemail.com': {
    name: 'Google',
    type: 'oauth',
    icon: 'google'
  },
  'outlook.com': {
    name: 'Microsoft',
    type: 'oauth',
    icon: 'microsoft'
  },
  'hotmail.com': {
    name: 'Microsoft',
    type: 'oauth',
    icon: 'microsoft'
  },
  'yahoo.com': {
    name: 'Yahoo',
    type: 'oauth',
    icon: 'yahoo'
  }
};

const EmailConnect: React.FC<EmailConnectProps> = ({ sessionId, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState<string | null>(null);
  const [isManual, setIsManual] = useState(false);
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Détecter le fournisseur email
  useEffect(() => {
    if (email) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain) {
        const provider = Object.entries(emailProviderMap).find(
          ([key]) => domain === key || domain.endsWith(`.${key}`)
        );
        if (provider) {
          setProvider(provider[1].name);
          setIsManual(provider[1].type !== 'oauth');
        } else {
          setProvider(null);
          setIsManual(true);
        }
      }
    }
  }, [email]);

  // Gérer la connexion OAuth
  const handleOAuthConnect = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/email-connect/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          email,
          provider: provider?.toLowerCase()
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la connexion OAuth');
      }

      const data = await response.json();
      onSuccess(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  // Gérer la connexion manuelle
  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/email-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          email,
          provider: 'manual',
          config: {
            imap: {
              host: imapHost,
              port: parseInt(imapPort),
              secure: imapPort === '993'
            },
            smtp: {
              host: smtpHost,
              port: parseInt(smtpPort),
              secure: smtpPort === '465'
            },
            auth: {
              user: email,
              pass: password
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la connexion');
      }

      const data = await response.json();
      onSuccess(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Mail className="h-6 w-6 text-green-500" />
        <h2 className="text-xl font-semibold">Connexion Email</h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Adresse email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="vous@exemple.com"
            required
          />
        </div>

        {provider && !isManual ? (
          <button
            onClick={handleOAuthConnect}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-green-300 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Se connecter avec {provider}
          </button>
        ) : email && isManual ? (
          <form onSubmit={handleManualConnect} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serveur IMAP
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="imap.exemple.com"
                  required
                />
                <input
                  type="text"
                  value={imapPort}
                  onChange={(e) => setImapPort(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="993"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serveur SMTP
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="smtp.exemple.com"
                  required
                />
                <input
                  type="text"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="587"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-green-300 transition-colors"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Se connecter
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
};

export default EmailConnect;