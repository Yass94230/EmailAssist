import React from 'react';
import { Mail } from 'lucide-react';
import { EmailAccount } from '../../types';

interface AccountSelectorProps {
  account: EmailAccount;
}

const AccountSelector: React.FC<AccountSelectorProps> = ({ account }) => {
  return (
    <button className="w-full flex items-center p-3 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="relative flex-shrink-0">
        {account.avatar ? (
          <img 
            src={account.avatar} 
            alt={account.name} 
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
            <Mail className="h-5 w-5 text-gray-500" />
          </div>
        )}
        {account.unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-medium text-white">
            {account.unread > 9 ? '9+' : account.unread}
          </span>
        )}
      </div>
      <div className="ml-3 text-left">
        <p className="text-sm font-medium">{account.name}</p>
        <p className="text-xs text-gray-500 truncate max-w-[150px]">{account.email}</p>
      </div>
    </button>
  );
};

export default AccountSelector;