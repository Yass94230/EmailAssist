import React, { useState, useEffect } from 'react';
import { Routes, Route, useSearchParams } from 'react-router-dom';
import Layout from './components/Layout';
import WhatsAppSetup from './components/WhatsApp/WhatsAppSetup';
import EmailConnect from './components/Account/EmailConnect';
import AdminLayout from './components/Admin/AdminLayout';
import Dashboard from './components/Admin/Dashboard';
import EmailConfig from './components/Admin/EmailConfig';
import WhatsAppConfig from './components/Admin/WhatsAppConfig';
import AudioConfig from './components/Admin/AudioConfig';

function App() {
  const [searchParams] = useSearchParams();
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

  // Si on a un ID de session dans l'URL, afficher la page de connexion email
  const sessionId = searchParams.get('id');
  if (sessionId) {
    return <EmailConnect />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="email" element={<EmailConfig />} />
        <Route path="whatsapp" element={<WhatsAppConfig />} />
        <Route path="audio" element={<AudioConfig />} />
      </Route>
      <Route
        path="*"
        element={
          <div className="min-h-screen bg-gray-100">
            {!phoneNumber ? (
              <WhatsAppSetup onSetup={handleWhatsAppSetup} />
            ) : (
              <Layout phoneNumber={phoneNumber} onLogout={handleLogout} />
            )}
          </div>
        }
      />
    </Routes>
  );
}

export default App;