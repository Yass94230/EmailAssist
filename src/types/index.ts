export interface Message {
  id: string;
  content: string;
  timestamp: Date;
  direction: 'incoming' | 'outgoing';
  audioUrl?: string;
  transcription?: string;  // Ajout du champ pour la transcription audio
}

export interface EmailRule {
  id: string;
  name: string;
  condition: string;
  action: 'markAsImportant' | 'moveToFolder' | 'markAsRead';
  parameters?: {
    folderName?: string;
    senderEmails?: string[];
  };
  isActive: boolean;
}

export interface EmailMessage {
  id: string;
  accountId: string;
  subject: string;
  sender: string;
  senderEmail: string;
  preview: string;
  body?: string;
  date: Date;
  isRead: boolean;
  isPriority: boolean;
  category: string;
  hasAttachments: boolean;
  hasEvent: boolean;
  labels?: string[];
  eventDetails?: {
    title: string;
    date: Date;
    location?: string;
    description?: string;
  };
}

export interface EmailAccount {
  id: string;
  name: string;
  email: string;
  type: 'personal' | 'work' | 'custom';
  unread: number;
  avatar?: string;
}

export interface Folder {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export interface UserPreference {
  id: string;
  type: 'rule' | 'preference';
  description: string;
  active: boolean;
  deleteAuthorized?: boolean;
}

export interface TwilioResponse {
  success: boolean;
  message: string;
  sid?: string;
}

export interface AudioSettings {
  enabled: boolean;
  voiceType: string;
}