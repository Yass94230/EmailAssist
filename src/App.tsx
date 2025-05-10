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

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout phoneNumber="+1234567890" onLogout={() => {}} />,
  },
  {
    path: '/connect',
    element: <EmailConnect />,
  },
  {
    path: '/setup',
    element: <WhatsAppSetup onSetup={() => {}} />,
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

function App() {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      <RouterProvider router={router} />
    </SessionContextProvider>
  );
}

export default App;