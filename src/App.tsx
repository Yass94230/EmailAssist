import { useState, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { SessionContextProvider, useSession } from '@supabase/auth-helpers-react';
import Layout from './components/Layout';
import AdminLayout from './components/Admin/AdminLayout';
import Dashboard from './components/Admin/Dashboard';
import EmailConfig from './components/Admin/EmailConfig';
import WhatsAppConfig from './components/Admin/WhatsAppConfig';
import AudioConfig from './components/Admin/AudioConfig';
import EmailConnect from './components/Account/EmailConnect';
import AuthContainer from './components/Auth/AuthContainer';
import { signOut } from './services/auth';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const session = useSession();

  useEffect(() => {
    console.log("Session actuelle:", session ? "Connecté" : "Non connecté");
    setIsLoading(false);
  }, [session]);

  // Déconnexion
  const handleLogout = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  // Fonction de redirection après connexion
  const handleAuthSuccess = () => {
    console.log("Authentification réussie dans App.tsx");
    window.location.href = '/admin';
  };

  const router = createBrowserRouter([
    {
      path: '/',
      element: !session ? (
        <AuthContainer onSuccess={handleAuthSuccess} />
      ) : (
        <Navigate to="/admin" replace />
      ),
    },
    {
      path: '/connect',
      element: <EmailConnect />,
    },
    {
      path: '/admin',
      element: session ? <AdminLayout /> : <Navigate to="/" />,
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