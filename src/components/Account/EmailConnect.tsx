import React from 'react';
import { Spinner } from '../ui/Spinner';

interface EmailConnectProps {
  isLoading?: boolean;
}

const EmailConnect: React.FC<EmailConnectProps> = ({ isLoading = false }) => {
  return (
    <>
      {isLoading && (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Spinner size="lg" className="text-green-500" />
        </div>
      )}
    </>
  );
};

export default EmailConnect;