import React from 'react';
import { MoreVertical, Search, Phone, Video } from 'lucide-react';

interface ChatHeaderProps {
  phoneNumber: string;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ phoneNumber }) => {
  return (
    <div className="bg-[#F0F2F5] px-4 py-3 flex items-center justify-between border-b border-gray-200">
      <div className="flex items-center">
        <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
          <span className="text-white font-semibold">AE</span>
        </div>
        <div className="ml-3">
          <h2 className="font-semibold">Assistant Email</h2>
          <p className="text-xs text-gray-500">
            Messages envoyés sur {phoneNumber}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button className="p-2 rounded-full hover:bg-gray-200">
          <Search size={20} className="text-gray-600" />
        </button>
        <button className="p-2 rounded-full hover:bg-gray-200">
          <Phone size={20} className="text-gray-600" />
        </button>
        <button className="p-2 rounded-full hover:bg-gray-200">
          <Video size={20} className="text-gray-600" />
        </button>
        <button className="p-2 rounded-full hover:bg-gray-200">
          <MoreVertical size={20} className="text-gray-600" />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;