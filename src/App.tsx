// Modification du composant App.tsx
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

// Initialisation du client Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const session = useSession();

  useEffect(() => {
    // Vérifier la session au chargement
    const checkSession = async () => {
      console.log("Vérification de la session...");
      const { data } = await supabase.auth.getSession();
      console.log("Session:", data.session ? "Connecté" : "Non connecté");
      
      // Si connecté, récupérer le numéro de téléphone
      if (data.session?.user?.phone) {
        localStorage.setItem('userWhatsAppNumber', data.session.user.phone);
      }
      
      setIsLoading(false);
    };
    
    checkSession();
    
    // Écouter les changements d'authentification
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Événement auth:", event, session ? "Connecté" : "Non connecté");
      
      // Si l'utilisateur se connecte, mettre à jour les informations locales
      if (event === 'SIGNED_IN' && session?.user) {
        if (session.user.phone) {
          localStorage.setItem('userWhatsAppNumber', session.user.phone);
        }
      }
      
      // Si l'utilisateur se déconnecte, supprimer les informations locales
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('userWhatsAppNumber');
      }
    });
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Déconnexion avec Supabase
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('userWhatsAppNumber');
      window.location.href = '/';
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  // Fonction de redirection après connexion
  const handleAuthSuccess = () => {
    console.log("Authentification réussie dans App.tsx");
    // La redirection est gérée dans LoginForm/RegisterForm
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
      element: session ? <AdminLayout onLogout={handleLogout} /> : <Navigate to="/" replace />,
      children: [
        {
          path: '',
          element: <Navigate to="/admin/email" replace />,
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
    // Ajouter une route pour la redirection après confirmation d'email
    {
      path: '/auth/callback',
      element: <Navigate to="/admin" replace />,
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