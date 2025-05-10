// Modification du App.tsx
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
import { supabase } from './services/supabase';  // Utiliser le client supabase exporté

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const session = useSession();

  useEffect(() => {
    console.log("App monté, vérification de la session...");
    
    // Vérifier la session au chargement
    const checkSession = async () => {
      try {
        console.log("Récupération de la session...");
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Erreur lors de la récupération de la session:", error);
          setIsAuthenticated(false);
        } else {
          console.log("Session récupérée:", data.session ? "Connecté" : "Non connecté");
          setIsAuthenticated(!!data.session);
          
          // Si connecté, récupérer le numéro de téléphone
          if (data.session?.user?.phone) {
            localStorage.setItem('userWhatsAppNumber', data.session.user.phone);
          }
        }
      } catch (err) {
        console.error("Exception lors de la vérification de la session:", err);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
        setAuthCheckComplete(true);
      }
    };
    
    checkSession();
    
    // Écouter les changements d'authentification
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Événement auth:", event, session ? "Connecté" : "Non connecté");
      setIsAuthenticated(!!session);
      
      // Si l'utilisateur se connecte, mettre à jour les informations locales
      if (event === 'SIGNED_IN' && session?.user) {
        console.log("Utilisateur connecté:", session.user);
        if (session.user.phone) {
          localStorage.setItem('userWhatsAppNumber', session.user.phone);
        }
      }
      
      // Si l'utilisateur se déconnecte, supprimer les informations locales
      if (event === 'SIGNED_OUT') {
        console.log("Utilisateur déconnecté");
        localStorage.removeItem('userWhatsAppNumber');
      }
    });
    
    return () => {
      console.log("App démonté, nettoyage des écouteurs");
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Déconnexion avec Supabase
  const handleLogout = async () => {
    try {
      console.log("Tentative de déconnexion...");
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Erreur lors de la déconnexion:', error);
        return;
      }
      
      console.log("Déconnexion réussie");
      localStorage.removeItem('userWhatsAppNumber');
      window.location.href = '/';
    } catch (error) {
      console.error('Exception lors de la déconnexion:', error);
    }
  };

  // Fonction de redirection après connexion
  const handleAuthSuccess = () => {
    console.log("Authentification réussie dans App.tsx");
    setIsAuthenticated(true);
    // La redirection est gérée dans LoginForm/RegisterForm
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  console.log("Rendu avec statut d'authentification:", isAuthenticated);

  const router = createBrowserRouter([
    {
      path: '/',
      element: !isAuthenticated ? (
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
      element: isAuthenticated ? (
        <AdminLayout />
      ) : (
        <Navigate to="/" replace />
      ),
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

  return (
    <SessionContextProvider 
      supabaseClient={supabase}
      initialSession={null}
    >
      <RouterProvider router={router} />
    </SessionContextProvider>
  );
}

export default App;