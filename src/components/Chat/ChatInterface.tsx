import React from 'react';
import { Spinner } from '../ui/Spinner';

interface ChatInterfaceProps {
  isLoading?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ isLoading = false }) => {
  return (
    <div className="flex flex-col">
      {/* Mise à jour de l'indicateur de chargement */}
      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500 mt-2">
          <Spinner size="sm" />
          <span>Envoi en cours...</span>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;