import React, { useState } from 'react';
import { Menu, X, ChevronDown, ChevronRight, Bell, LogOut, Mail, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import GmailOAuthManager from '../Account/GmailOAuthManager';
import AudioSettings from '../Settings/AudioSettings';

interface SidebarProps {
  onClose: () => void;
  phoneNumber: string;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose, phoneNumber, onLogout }) => {
  const [expandedSections, setExpandedSections] = useState({
    accounts: true,
    settings: false
  });

  const toggleSection = (section: 'accounts' | 'settings') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleLogoutClick = () => {
    if (window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      onLogout();
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-white border-r border-gray-200">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Assistant Email</h1>
            <p className="text-xs text-gray-500">{phoneNumber}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-2 rounded-full hover:bg-gray-100"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Section Comptes */}
        <div>
          <button
            onClick={() => toggleSection('accounts')}
            className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg"
          >
            <span className="font-medium">Configuration Email</span>
            {expandedSections.accounts ? (
              <ChevronDown size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
          </button>
          
          {expandedSections.accounts && (
            <div className="mt-2 space-y-2">
              <GmailOAuthManager phoneNumber={phoneNumber} />
            </div>
          )}
        </div>

        {/* Section Paramètres */}
        <div>
          <button
            onClick={() => toggleSection('settings')}
            className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg"
          >
            <span className="font-medium">Paramètres</span>
            {expandedSections.settings ? (
              <ChevronDown size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
          </button>
          
          {expandedSections.settings && (
            <div className="mt-2 space-y-4">
              <AudioSettings phoneNumber={phoneNumber} />
            </div>
          )}
        </div>

        {/* Lien vers l'interface d'administration */}
        <Link
          to="/admin"
          className="w-full flex items-center p-2 rounded-lg hover:bg-gray-100"
        >
          <Settings size={18} className="mr-2 text-gray-500" />
          <span className="text-sm font-medium">Administration</span>
        </Link>
      </div>

      <div className="border-t border-gray-200 p-4 space-y-2">
        <button className="w-full flex items-center p-2 rounded-lg hover:bg-gray-100">
          <Bell size={18} className="mr-2 text-gray-500" />
          <span className="text-sm font-medium">Notifications</span>
        </button>
        <button 
          onClick={handleLogoutClick}
          className="w-full flex items-center p-2 rounded-lg hover:bg-gray-100 text-red-600"
        >
          <LogOut size={18} className="mr-2" />
          <span className="text-sm font-medium">Déconnexion</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;