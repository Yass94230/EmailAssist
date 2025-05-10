import { useState, useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import Layout from './components/Layout';
import AdminLayout from './components/Admin/AdminLayout';
import Dashboard from './components/Admin/Dashboard';
import EmailConfig from './components/Admin/EmailConfig';
import WhatsAppConfig from './components/Admin/WhatsAppConfig';
import AudioConfig from './components/Admin/AudioConfig';
import WhatsAppSetup from './components/WhatsApp/WhatsAppSetup';
import EmailConnect from './components/Account/EmailConnect';
import { signOut } from './services/auth';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

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

  const handleLogout = async () => {
    try {
      await signOut();
      localStorage.removeItem('userWhatsAppNumber');
      localStorage.removeItem('whatsapp_verified');
      setPhoneNumber(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const router = createBrowserRouter([
    {
      path: '/',
      element: phoneNumber ? (
        <Layout phoneNumber={phoneNumber} onLogout={handleLogout} />
      ) : (
        <WhatsAppSetup onSetup={setPhoneNumber} />
      ),
    },
    {
      path: '/connect',
      element: <EmailConnect />,
    },
    {
      path: '/admin',
      element: <AdminLayout />,
      children: [
        {
          index: true,
          element: <Dashboard />,
        },
        {
          path: 'email',
          element: <EmailConfig />,
        },
        {
          path: 'whatsapp',
          element: <WhatsAppConfig />,
        },
        {
          path: 'audio',
          element: <AudioConfig />,
        },
      ],
    },
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <SessionContextProvider supabaseClient={supabase}>
      <RouterProvider router={router} />
    </SessionContextProvider>
  );
}

export default App;