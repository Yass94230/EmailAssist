// src/components/ui/Alert.tsx
import React from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error' | 'destructive';

interface AlertProps {
  children: React.ReactNode;
  variant?: AlertVariant;
  className?: string;
}

const Alert: React.FC<AlertProps> = ({ 
  children, 
  variant = 'info', 
  className = '' 
}) => {
  const variantClasses = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    destructive: 'bg-red-50 text-red-800 border-red-200'
  };

  return (
    <div 
      className={`${variantClasses[variant]} border rounded-md p-4 ${className}`}
      role="alert"
    >
      {children}
    </div>
  );
};

export default Alert;