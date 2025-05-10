import { useState, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { SessionContextProvider, useSession } from '@supabase/auth-helpers-react';
import Layout from './components/Layout';
import AdminLayout from './components/Admin/AdminLayout';
import Dashboard from './components/Admin/Dashboard';
import EmailConfig from './components/Admin/EmailConfig';
import WhatsAppConfig from './components/Admin/WhatsAppConfig';
import AudioConfig from './components/Admin/AudioConfig';
import EmailConnect from './components/Account/EmailConnect';
import AuthContainer from './components/Auth/AuthContainer';
import { supabase } from './services/supabase';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const session = useSession();

  useEffect(() => {
    console.log("App monté, vérification de la session...");
    
    // Vérifier la session au chargement
    const checkSession = async () => {
      try {
        console.log("Récupération de la session...");
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Erreur lors de la récupération de la session:", error);
          setIsAuthenticated(false);
        } else {
          console.log("Session récupérée:", session ? "Connecté" : "Non connecté");
          setIsAuthenticated(!!session);
          
          // Si connecté, récupérer le numéro de téléphone
          if (session?.user?.phone) {
            localStorage.setItem('userWhatsAppNumber', session.user.phone);
          }
        }
      } catch (err) {
        console.error("Exception lors de la vérification de la session:", err);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSession();
    
    // Écouter les changements d'authentification
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Événement auth:", event, session ? "Connecté" : "Non connecté");
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log("Utilisateur connecté:", session.user);
        setIsAuthenticated(true);
        
        if (session.user.phone) {
          localStorage.setItem('userWhatsAppNumber', session.user.phone);
        }
        
        // Vérifier si l'utilisateur a des paramètres
        const { data: settings } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        
        if (!settings && session.user.phone) {
          // Créer les paramètres par défaut
          await supabase
            .from('user_settings')
            .insert({
              user_id: session.user.id,
              phone_number: session.user.phone,
              audio_enabled: true,
              voice_recognition_enabled: true,
              voice_type: 'alloy'
            });
        }
      } else if (event === 'SIGNED_OUT') {
        console.log("Utilisateur déconnecté");
        setIsAuthenticated(false);
        localStorage.removeItem('userWhatsAppNumber');
      }
    });
    
    return () => {
      console.log("App démonté, nettoyage des écouteurs");
      authListener.subscription.unsubscribe();
    };
  }, []);

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
        <AuthContainer onSuccess={() => setIsAuthenticated(true)} />
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