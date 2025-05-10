import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Alert } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';
import { registerWhatsAppNumber } from '../../services/whatsapp';

interface WhatsAppSetupProps {
  onNumberRegistered?: (phoneNumber: string) => void;
  defaultPhoneNumber?: string;
}

const WhatsAppSetup: React.FC<WhatsAppSetupProps> = ({ 
  onNumberRegistered,
  defaultPhoneNumber = ''
}) => {
  const [phoneNumber, setPhoneNumber] = useState(defaultPhoneNumber);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (defaultPhoneNumber) {
      setPhoneNumber(defaultPhoneNumber);
    }
  }, [defaultPhoneNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      setError('Veuillez entrer un numéro de téléphone');
      return;
    }
    
    // Format the phone number: remove spaces and ensure it starts with +
    const formattedNumber = formatPhoneNumber(phoneNumber);
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await registerWhatsAppNumber(formattedNumber);
      setSuccess('Numéro WhatsApp enregistré avec succès!');
      
      if (onNumberRegistered) {
        onNumberRegistered(formattedNumber);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de l\'enregistrement du numéro');
      console.error('Error registering WhatsApp number:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatPhoneNumber = (number: string): string => {
    // Remove all non-digit characters except for the + sign
    const cleaned = number.replace(/[^\d+]/g, '');
    
    // Ensure the number starts with a +
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  };

  return (
    <Card className="p-6 max-w-md w-full">
      <h2 className="text-xl font-semibold mb-4">Configuration WhatsApp</h2>
      
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
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+33612345678"
            className="w-full"
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
            'Enregistrer le numéro'
          )}
        </Button>
      </form>
    </Card>
  );
};

export default WhatsAppSetup;