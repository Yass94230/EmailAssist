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

  // Debug log - afficher l'état de la session à chaque rendu
  useEffect(() => {
    console.log("Session actuelle:", session ? "Connecté" : "Non connecté");
    console.log("PhoneNumber:", phoneNumber);
  }, [session, phoneNumber]);

  useEffect(() => {
    const checkUserData = async () => {
      console.log("Vérification des données utilisateur...");
      
      // Récupérer les informations WhatsApp du localStorage
      const savedNumber = localStorage.getItem('userWhatsAppNumber');
      const isVerified = localStorage.getItem('whatsapp_verified') === 'true';
      
      console.log("Données localStorage:", { savedNumber, isVerified });
      
      if (savedNumber && isVerified) {
        setPhoneNumber(savedNumber);
      }
      
      // Vérifier la session Supabase
      const { data } = await supabase.auth.getSession();
      
      if (data?.session?.user) {
        console.log("Utilisateur connecté:", data.session.user.email);
        
        // Si l'utilisateur est connecté mais n'a pas de numéro WhatsApp en local
        if (!savedNumber || !isVerified) {
          try {
            console.log("Recherche du numéro WhatsApp dans la base de données...");
            
            // Vérifier dans la base de données
            const { data: whatsappData, error } = await supabase
              .from('user_whatsapp')
              .select('phone_number')
              .eq('user_id', data.session.user.id)
              .maybeSingle();
              
            if (error) {
              console.error("Erreur lors de la requête:", error);
            }
            
            console.log("Données WhatsApp trouvées:", whatsappData);
            
            if (whatsappData?.phone_number) {
              localStorage.setItem('userWhatsAppNumber', whatsappData.phone_number);
              localStorage.setItem('whatsapp_verified', 'true');
              setPhoneNumber(whatsappData.phone_number);
              
              console.log("Numéro WhatsApp défini depuis la base de données:", whatsappData.phone_number);
            }
          } catch (error) {
            console.error("Erreur lors de la récupération des données WhatsApp:", error);
          }
        }
      } else {
        console.log("Aucun utilisateur connecté");
      }
      
      setIsLoading(false);
    };
    
    checkUserData();
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
    console.log("Authentification réussie dans App.tsx");
    
    // Pas besoin de rediriger ici, nous utilisons window.location.href dans les composants de formulaire
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