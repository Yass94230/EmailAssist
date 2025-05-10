import React, { useState } from 'react';
import { Phone, ArrowRight } from 'lucide-react';
import { sendSMS } from '../services/sms';

interface SMSSetupProps {
  onSetup: (phoneNumber: string) => void;
}

const SMSSetup: React.FC<SMSSetupProps> = ({ onSetup }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await sendSMS(
        phoneNumber,
        "Bonjour ! Je suis votre assistant email. Je vais vous aider à gérer vos emails efficacement."
      );
      onSetup(phoneNumber);
    } catch (err) {
      setError("Erreur lors de l'envoi du SMS. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <div className="h-16 w-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Assistant Email par SMS</h2>
          <p className="text-gray-600 mt-2">Entrez votre numéro de téléphone pour commencer</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Numéro de téléphone
            </label>
            <input
              type="tel"
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+33 6 12 34 56 78"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center disabled:bg-blue-300"
          >
            <span>{isLoading ? 'Envoi en cours...' : 'Continuer'}</span>
            {!isLoading && <ArrowRight className="ml-2 h-5 w-5" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SMSSetup;