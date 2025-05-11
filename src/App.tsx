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
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const session = useSession();

  useEffect(() => {
    console.log("App monté, vérification de la session...");
    
    const checkSession = async () => {
      try {
        console.log("Récupération de la session...");
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Erreur lors de la récupération de la session:", error);
          setIsAuthenticated(false);
          return;
        }

        if (session?.user) {
          console.log("Session trouvée:", session.user);
          setIsAuthenticated(true);
          
          // Récupérer le numéro de téléphone
          const storedNumber = localStorage.getItem('userWhatsAppNumber');
          if (storedNumber) {
            setPhoneNumber(storedNumber);
          } else if (session.user.phone) {
            setPhoneNumber(session.user.phone);
            localStorage.setItem('userWhatsAppNumber', session.user.phone);
          }

          // Vérifier/créer les paramètres utilisateur
          const { data: settings, error: settingsError } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (!settings && !settingsError) {
            const phone = session.user.phone || storedNumber;
            if (phone) {
              await supabase
                .from('user_settings')
                .insert({
                  user_id: session.user.id,
                  phone_number: phone,
                  audio_enabled: true,
                  voice_recognition_enabled: true,
                  voice_type: 'alloy'
                });
            }
          }
        } else {
          console.log("Aucune session trouvée");
          setIsAuthenticated(false);
          setPhoneNumber(null);
        }
      } catch (err) {
        console.error("Exception lors de la vérification de la session:", err);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSession();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Événement auth:", event, session ? "Connecté" : "Non connecté");
      
      if (event === 'SIGNED_IN' && session?.user) {
        setIsAuthenticated(true);
        
        const phone = session.user.phone || localStorage.getItem('userWhatsAppNumber');
        if (phone) {
          setPhoneNumber(phone);
          localStorage.setItem('userWhatsAppNumber', phone);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log("Utilisateur déconnecté");
        setIsAuthenticated(false);
        setPhoneNumber(null);
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

  const router = createBrowserRouter([
    {
      path: '/',
      element: !isAuthenticated ? (
        <AuthContainer onSuccess={() => setIsAuthenticated(true)} />
      ) : phoneNumber ? (
        <Layout phoneNumber={phoneNumber} onLogout={() => setIsAuthenticated(false)} />
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