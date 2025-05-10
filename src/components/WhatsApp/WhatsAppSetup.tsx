import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Alert } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';
import { registerWhatsAppNumber, verifyWhatsAppNumber } from '../../services/whatsapp';

interface WhatsAppSetupProps {
  onSetup: (phoneNumber: string) => void;
}

const WhatsAppSetup: React.FC<WhatsAppSetupProps> = ({ onSetup }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Vérifier le statut toutes les 5 secondes après l'envoi de "join"
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isVerifying && phoneNumber) {
      interval = setInterval(async () => {
        try {
          const isVerified = await verifyWhatsAppNumber(phoneNumber);
          if (isVerified) {
            localStorage.setItem('whatsapp_verified', 'true');
            localStorage.setItem('userWhatsAppNumber', phoneNumber);
            setIsVerifying(false);
            onSetup(phoneNumber);
          }
        } catch (error) {
          console.error('Error checking verification:', error);
        }
      }, 5000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isVerifying, phoneNumber, onSetup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await registerWhatsAppNumber(phoneNumber);
      
      if (result.success) {
        setSuccess('Pour activer WhatsApp, envoyez "join police-hour" au numéro +14155238886');
        setIsVerifying(true); // Démarrer la vérification automatique
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement');
      setIsVerifying(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Configuration WhatsApp</h2>

        {error && (
          <Alert variant="destructive" className="mb-4">
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-4">
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Numéro de téléphone WhatsApp
            </label>
            <Input
              id="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+33612345678"
              required
              disabled={isLoading || isVerifying}
            />
            <p className="mt-1 text-sm text-gray-500">
              Format international (ex: +33612345678)
            </p>
          </div>

          <Button
            type="submit"
            disabled={isLoading || isVerifying}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Enregistrement...
              </>
            ) : isVerifying ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Vérification en cours...
              </>
            ) : (
              'Configurer WhatsApp'
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default WhatsAppSetup;