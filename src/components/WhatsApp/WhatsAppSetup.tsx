import React, { useState } from 'react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await registerWhatsAppNumber(phoneNumber);
      const isVerified = await verifyWhatsAppNumber(phoneNumber);

      if (isVerified) {
        onSetup(phoneNumber);
      } else {
        setSuccess('Pour activer WhatsApp, envoyez "join" au numéro +14155238886');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement');
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
              disabled={isLoading}
            />
            <p className="mt-1 text-sm text-gray-500">
              Format international (ex: +33612345678)
            </p>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Enregistrement...
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