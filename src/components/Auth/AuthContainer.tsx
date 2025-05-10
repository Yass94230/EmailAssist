import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import { useNavigate } from 'react-router-dom';

interface AuthContainerProps {
  onSuccess: () => void;
}

const AuthContainer: React.FC<AuthContainerProps> = ({ onSuccess }) => {
  const [showRegister, setShowRegister] = useState(false);
  const navigate = useNavigate();

  // Fonction qui sera appelée après une connexion ou inscription réussie
  const handleAuthSuccess = () => {
    console.log("Authentification réussie dans AuthContainer");
    onSuccess();
    
    // Vérifier si l'utilisateur a déjà configuré WhatsApp
    const phoneNumber = localStorage.getItem('userWhatsAppNumber');
    const isVerified = localStorage.getItem('whatsapp_verified') === 'true';
    
    if (phoneNumber && isVerified) {
      navigate('/admin');
    }
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