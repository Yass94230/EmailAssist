import React, { useState, useEffect } from 'react';
import { verifyWhatsAppNumber, saveUserWhatsAppNumber, isCurrentNumberVerified } from '../../services/whatsapp';

interface WhatsAppSetupProps {
  onSetup: (phoneNumber: string) => void;
}

// Fonction de validation du numéro de téléphone
const isValidPhoneNumber = (number: string) => {
  return /^\+[1-9]\d{1,14}$/.test(number);
};

// Fonction pour formater automatiquement le numéro
const formatPhoneNumber = (input: string) => {
  const cleaned = input.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+') && cleaned.length > 0) {
    return '+' + cleaned;
  }
  return cleaned;
};

const WhatsAppSetup: React.FC<WhatsAppSetupProps> = ({ onSetup }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [savedNumber, setSavedNumber] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | null; message: string }>({ 
    type: null, 
    message: '' 
  });

  // Charger et vérifier le numéro au démarrage
  useEffect(() => {
    const loadSavedNumber = async () => {
      const savedWhatsAppNumber = localStorage.getItem('userWhatsAppNumber');
      if (savedWhatsAppNumber) {
        setSavedNumber(savedWhatsAppNumber);
        setPhoneNumber(savedWhatsAppNumber);
        
        // Vérifier si ce numéro est déjà vérifié
        setIsProcessing(true);
        try {
          const verified = await isCurrentNumberVerified();
          setIsVerified(verified);
          
          if (verified) {
            setStatus({
              type: 'success',
              message: 'Votre numéro WhatsApp est vérifié et prêt à recevoir des messages.'
            });
            onSetup(savedWhatsAppNumber);
          } else {
            setStatus({
              type: 'info',
              message: 'Pour activer les notifications WhatsApp, envoyez "join" à +14155238886, puis cliquez sur "Vérifier".'
            });
          }
        } catch (error) {
          console.error('Erreur lors de la vérification du numéro:', error);
        } finally {
          setIsProcessing(false);
        }
      }
    };
    
    loadSavedNumber();
    
    // Écouter les événements de vérification WhatsApp
    const handleVerified = (event: CustomEvent) => {
      if (event.detail?.verified) {
        setIsVerified(true);
        setStatus({
          type: 'success',
          message: 'Votre numéro WhatsApp est vérifié et prêt à recevoir des messages.'
        });
        if (event.detail?.phoneNumber) {
          onSetup(event.detail.phoneNumber);
        }
      }
    };
    
    window.addEventListener('whatsapp_verified', handleVerified as EventListener);
    
    return () => {
      window.removeEventListener('whatsapp_verified', handleVerified as EventListener);
    };
  }, [onSetup]);

  // Vérifier le numéro manuellement
  const handleVerify = async () => {
    if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
      setStatus({
        type: 'error',
        message: 'Numéro de téléphone invalide. Utilisez le format international (ex: +33612345678)'
      });
      return;
    }
    
    setIsProcessing(true);
    setStatus({
      type: 'info',
      message: 'Vérification en cours...'
    });
    
    try {
      const isVerified = await verifyWhatsAppNumber(phoneNumber);
      setIsVerified(isVerified);
      
      if (isVerified) {
        localStorage.setItem('whatsapp_verified', 'true');
        setStatus({
          type: 'success',
          message: 'Votre numéro WhatsApp est vérifié et prêt à recevoir des messages.'
        });
        onSetup(phoneNumber);
      } else {
        setStatus({
          type: 'info',
          message: 'Ce numéro n\'est pas encore vérifié. Envoyez "join" à +14155238886, puis réessayez.'
        });
      }
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      setStatus({
        type: 'error',
        message: 'Une erreur est survenue lors de la vérification. Veuillez réessayer.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Enregistrer le numéro
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidPhoneNumber(phoneNumber)) {
      setStatus({ 
        type: 'error', 
        message: 'Numéro de téléphone invalide. Utilisez le format international (ex: +33612345678)' 
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const result = await saveUserWhatsAppNumber(phoneNumber);
      
      setSavedNumber(phoneNumber);
      setIsVerified(result.verified);
      
      setStatus({ 
        type: result.success ? 'info' : 'error', 
        message: result.message 
      });
      
      if (result.verified) {
        onSetup(phoneNumber);
      }
      
      // Vérifier automatiquement après un délai
      if (result.success) {
        setTimeout(async () => {
          try {
            const verified = await verifyWhatsAppNumber(phoneNumber);
            setIsVerified(verified);
            if (verified) {
              localStorage.setItem('whatsapp_verified', 'true');
              setStatus({
                type: 'success',
                message: 'Votre numéro WhatsApp est maintenant vérifié!'
              });
              onSetup(phoneNumber);
            }
          } catch (error) {
            console.error('Erreur de vérification automatique:', error);
          }
        }, 15000); // Vérifier après 15 secondes
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
      setStatus({ 
        type: 'error', 
        message: error instanceof Error 
          ? `Erreur: ${error.message}` 
          : 'Une erreur inconnue est survenue lors de l\'enregistrement du numéro'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Réinitialiser le numéro
  const handleReset = () => {
    localStorage.removeItem('userWhatsAppNumber');
    localStorage.removeItem('whatsapp_verified');
    setSavedNumber(null);
    setIsVerified(false);
    setPhoneNumber('');
    setStatus({ type: null, message: '' });
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Configuration WhatsApp</h2>
      
      {status.type && (
        <div className={`mb-4 p-3 rounded ${
          status.type === 'success' ? 'bg-green-100 text-green-800' : 
          status.type === 'error' ? 'bg-red-100 text-red-800' : 
          'bg-blue-100 text-blue-800'
        }`}>
          {status.message}
        </div>
      )}
      
      {savedNumber && isVerified ? (
        <div className="mb-6">
          <div className="mb-4 p-4 rounded bg-green-100 text-green-800">
            <p className="font-medium">Votre numéro WhatsApp est configuré</p>
            <p className="mt-1">Vous recevrez des notifications sur {savedNumber}</p>
          </div>
          
          <button
            onClick={handleReset}
            className="w-full py-2 px-4 mt-2 rounded-lg text-white font-medium bg-red-600 hover:bg-red-700"
            disabled={isProcessing}
          >
            Modifier mon numéro
          </button>
        </div>
      ) : (
        <>
          {savedNumber && !isVerified && (
            <div className="mb-4 p-3 rounded bg-yellow-100 text-yellow-800">
              <p>Pour activer les notifications, envoyez le message "join" au numéro WhatsApp <strong>+14155238886</strong></p>
              <p className="mt-1">Une fois fait, cliquez sur "Vérifier".</p>
            </div>
          )}
          
          <form onSubmit={savedNumber ? (e) => { e.preventDefault(); handleVerify(); } : handleSubmit}>
            <div className="mb-4">
              <label htmlFor="phoneNumber" className="block text-gray-700 font-medium mb-2">
                Votre numéro WhatsApp
              </label>
              <input
                type="text"
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setPhoneNumber(formatted);
                }}
                placeholder="+33612345678"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  phoneNumber && !isValidPhoneNumber(phoneNumber) 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'focus:ring-blue-500'
                }`}
                disabled={isProcessing}
                required
              />
              {phoneNumber && !isValidPhoneNumber(phoneNumber) && (
                <p className="text-sm text-red-500 mt-1">
                  Format invalide. Utilisez le format international (ex: +33612345678)
                </p>
              )}
              <p className="text-sm text-gray-500 mt-1">Format: +[code pays][numéro] (ex: +33612345678)</p>
            </div>
            
            <button
              type="submit"
              disabled={isProcessing || (phoneNumber && !isValidPhoneNumber(phoneNumber))}
              className={`w-full py-2 px-4 rounded-lg text-white font-medium ${
                isProcessing || (phoneNumber && !isValidPhoneNumber(phoneNumber)) 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isProcessing 
                ? 'Traitement en cours...' 
                : savedNumber 
                  ? 'Vérifier' 
                  : 'Enregistrer mon numéro'
              }
            </button>
            
            {savedNumber && !isVerified && (
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2 px-4 mt-2 rounded-lg text-gray-700 font-medium border border-gray-300 hover:bg-gray-100"
                disabled={isProcessing}
              >
                Annuler
              </button>
            )}
          </form>
        </>
      )}
    </div>
  );
};

export default WhatsAppSetup;