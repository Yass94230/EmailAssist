import React from 'react';
import { Settings, Mail, MessageSquare, Volume2 } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const AdminLayout: React.FC = () => {
  const location = useLocation();

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
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <nav className="space-y-1">
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
            </nav>
          </div>

          {/* Main content */}
          <div className="flex-1">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;