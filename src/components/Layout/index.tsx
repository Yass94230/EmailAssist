import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import ChatInterface from '../Chat/ChatInterface';

interface LayoutProps {
  phoneNumber: string;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ phoneNumber, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar mobile toggle */}
      <button
        className="lg:hidden fixed z-50 bottom-4 right-4 p-3 rounded-full bg-green-500 text-white shadow-lg"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 transform lg:relative lg:translate-x-0 transition duration-300 ease-in-out z-40 w-80 xl:w-96 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <Sidebar 
          onClose={() => setSidebarOpen(false)} 
          phoneNumber={phoneNumber} 
          onLogout={onLogout} 
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-gray-100">
        <ChatInterface phoneNumber={phoneNumber} />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default Layout;