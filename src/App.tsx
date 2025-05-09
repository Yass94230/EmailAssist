import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import WhatsAppSetup from './components/WhatsApp/WhatsAppSetup';

function App() {
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedNumber = localStorage.getItem('userWhatsAppNumber');
    const isVerified = localStorage.getItem('whatsapp_verified') === 'true';
    
    if (savedNumber && isVerified) {
      setPhoneNumber(savedNumber);
    }
    setIsLoading(false);
  }, []);

  const handleWhatsAppSetup = (number: string) => {
    setPhoneNumber(number);
    localStorage.setItem('userWhatsAppNumber', number);
  };

  const handleLogout = () => {
    localStorage.removeItem('userWhatsAppNumber');
    localStorage.removeItem('whatsapp_verified');
    setPhoneNumber(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {!phoneNumber ? (
        <WhatsAppSetup onSetup={handleWhatsAppSetup} />
      ) : (
        <Layout phoneNumber={phoneNumber} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;