import React, { useEffect } from 'react';
import { Settings, Mail, MessageSquare, Volume2 } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Rediriger vers la page email si l'utilisateur est sur la page admin par défaut
    if (location.pathname === '/admin') {
      navigate('/admin/email');
    }
  }, [location.pathname, navigate]);

  const isActive = (path: string) => {
    return location.pathname === `/admin${path}`;
  };

  const navItems = [
    { path: '', icon: Settings, label: 'Vue d\'ensemble' },
    { path: '/email', icon: Mail, label: 'Configuration Email' },
    { path: '/whatsapp', icon: MessageSquare, label: 'Configuration WhatsApp' },
    { path: '/audio', icon: Volume2, label: 'Paramètres Audio' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 flex-shrink-0">
            <nav className="space-y-1 bg-white shadow rounded-lg p-4">
              {navItems.map(({ path, icon: Icon, label }) => (
                <Link
                  key={path}
                  to={`/admin${path}`}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${
                    isActive(path)
                      ? 'bg-green-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {label}
                </Link>
              ))}
              
              <div className="border-t border-gray-200 my-4 pt-4">
                <Link
                  to="/"
                  className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  <span className="mr-3">←</span>
                  Retour à l'application
                </Link>
              </div>
            </nav>
          </div>

          {/* Main content */}
          <div className="flex-1 bg-white shadow rounded-lg p-6">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;