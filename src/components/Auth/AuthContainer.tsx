import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

interface AuthContainerProps {
  onSuccess: () => void;
}

const AuthContainer: React.FC<AuthContainerProps> = ({ onSuccess }) => {
  const [showRegister, setShowRegister] = useState(false);

  // Fonction qui sera appelée après une connexion ou inscription réussie
  const handleAuthSuccess = () => {
    console.log("Authentification réussie dans AuthContainer");
    onSuccess();
  };

  return showRegister ? (
    <RegisterForm 
      onSuccess={handleAuthSuccess}
      onBackToLogin={() => setShowRegister(false)}
    />
  ) : (
    <LoginForm 
      onSuccess={handleAuthSuccess}
      onRegister={() => setShowRegister(true)}
    />
  );
};

export default AuthContainer;