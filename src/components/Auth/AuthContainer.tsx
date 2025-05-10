import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

interface AuthContainerProps {
  onSuccess: () => void;
}

const AuthContainer: React.FC<AuthContainerProps> = ({ onSuccess }) => {
  const [showRegister, setShowRegister] = useState(false);

  return showRegister ? (
    <RegisterForm 
      onSuccess={onSuccess}
      onBackToLogin={() => setShowRegister(false)}
    />
  ) : (
    <LoginForm 
      onSuccess={onSuccess}
      onRegister={() => setShowRegister(true)}
    />
  );
};

export default AuthContainer;