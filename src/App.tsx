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
import WhatsAppSetup from './components/WhatsApp/WhatsAppSetup';
import EmailConnect from './components/Account/EmailConnect';
import AuthContainer from './components/Auth/AuthContainer';
import { signOut } from './services/auth';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const session = useSession();

  useEffect(() => {
    // Récupérer les informations WhatsApp du localStorage
    const savedNumber = localStorage.getItem('userWhatsAppNumber');
    const isVerified = localStorage.getItem('whatsapp_verified') === 'true';
    
    if (savedNumber && isVerified) {
      setPhoneNumber(savedNumber);
    }
    
    // Vérifier la session Supabase au chargement
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      console.log("Session au chargement:", data?.session ? "Connecté" : "Non connecté");
      
      // Si l'utilisateur est déjà connecté mais n'a pas de configuration WhatsApp
      if (data?.session && !phoneNumber) {
        // Vérifier dans la base de données si l'utilisateur a déjà un numéro WhatsApp
        try {
          const { data: whatsappData } = await supabase
            .from('user_whatsapp')
            .select('phone_number')
            .eq('user_id', data.session.user.id)
            .maybeSingle();
            
          if (whatsappData?.phone_number) {
            localStorage.setItem('userWhatsAppNumber', whatsappData.phone_number);
            localStorage.setItem('whatsapp_verified', 'true');
            setPhoneNumber(whatsappData.phone_number);
          }
        } catch (error) {
          console.error("Erreur lors de la récupération des données WhatsApp:", error);
        }
      }
      
      setIsLoading(false);
    };
    
    checkSession();
  }, []);

  // Déconnexion
  const handleLogout = async () => {
    try {
      await signOut();
      localStorage.removeItem('userWhatsAppNumber');
      localStorage.removeItem('whatsapp_verified');
      setPhoneNumber(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  // Fonction de redirection après connexion
  const handleAuthSuccess = () => {
    console.log("Authentification réussie");
    window.location.reload(); // Recharger la page pour mettre à jour le contexte de session
  };

  const router = createBrowserRouter([
    {
      path: '/',
      element: !session ? (
        <AuthContainer onSuccess={handleAuthSuccess} />
      ) : !phoneNumber ? (
        <WhatsAppSetup onSetup={setPhoneNumber} />
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