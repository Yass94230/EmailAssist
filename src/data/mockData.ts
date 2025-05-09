import { EmailAccount, EmailMessage, Folder, UserPreference, ChatMessage } from '../types';

export const accounts: EmailAccount[] = [
  {
    id: 'personal',
    name: 'Personnel',
    email: 'utilisateur@gmail.com',
    type: 'personal',
    unread: 3,
    avatar: 'https://images.pexels.com/photos/6347919/pexels-photo-6347919.jpeg?auto=compress&cs=tinysrgb&w=150'
  },
  {
    id: 'work',
    name: 'Professionnel',
    email: 'utilisateur@entreprise.com',
    type: 'work',
    unread: 7,
    avatar: 'https://images.pexels.com/photos/5538348/pexels-photo-5538348.jpeg?auto=compress&cs=tinysrgb&w=150'
  },
  {
    id: 'custom',
    name: 'Freelance',
    email: 'utilisateur@freelance.com',
    type: 'custom',
    unread: 2,
    avatar: 'https://images.pexels.com/photos/5673488/pexels-photo-5673488.jpeg?auto=compress&cs=tinysrgb&w=150'
  }
];

export const folders: Folder[] = [
  { id: 'f1', name: 'Boîte de réception', icon: 'inbox', count: 12 },
  { id: 'f2', name: 'À faire', icon: 'check-square', count: 5 },
  { id: 'f3', name: 'Important', icon: 'alert-circle', count: 3 },
  { id: 'f4', name: 'Professionnel', icon: 'briefcase', count: 7 },
  { id: 'f5', name: 'Personnel', icon: 'user', count: 4 },
  { id: 'f6', name: 'Newsletters', icon: 'mail', count: 15 },
  { id: 'f7', name: 'Agenda en attente', icon: 'calendar', count: 2 }
];

export const emails: EmailMessage[] = [
  {
    id: 'em1',
    accountId: 'personal',
    subject: 'Votre commande Amazon #123-4567890-1234567',
    sender: 'Amazon',
    senderEmail: 'commandes@amazon.fr',
    preview: 'Votre commande a été expédiée et arrivera lundi.',
    date: new Date(Date.now() - 25 * 60000),
    isRead: false,
    isPriority: false,
    category: 'updates',
    hasAttachments: true,
    hasEvent: false
  },
  {
    id: 'em2',
    accountId: 'work',
    subject: 'URGENT : Maintenance serveur',
    sender: 'Service Informatique',
    senderEmail: 'it@entreprise.fr',
    preview: 'Notre serveur principal sera en maintenance ce soir à 23h.',
    date: new Date(Date.now() - 45 * 60000),
    isRead: false,
    isPriority: true,
    category: 'urgent',
    hasAttachments: false,
    hasEvent: true,
    eventDetails: {
      title: 'Maintenance Serveur',
      date: new Date(Date.now() + 24 * 60 * 60000),
      location: 'À distance',
      description: 'Maintenance planifiée des serveurs de production.'
    }
  },
  {
    id: 'em3',
    accountId: 'personal',
    subject: 'Votre rendez-vous avec Dr. Youssef',
    sender: 'Centre Médical',
    senderEmail: 'rdv@medical.fr',
    preview: 'Rappel de votre rendez-vous avec Dr. Youssef demain à 14h.',
    date: new Date(Date.now() - 2 * 60 * 60000),
    isRead: true,
    isPriority: true,
    category: 'important',
    hasAttachments: false,
    hasEvent: true,
    eventDetails: {
      title: 'Rendez-vous Dr. Youssef',
      date: new Date(Date.now() + 24 * 60 * 60000),
      location: 'Centre Médical, 123 Rue de la Santé',
      description: 'Consultation de routine.'
    }
  },
  {
    id: 'em4',
    accountId: 'work',
    subject: 'Réunion équipe - Point projet',
    sender: 'Chef de Projet',
    senderEmail: 'cdp@entreprise.fr',
    preview: 'Réunissons-nous pour discuter de l\'avancement du projet vendredi à 10h.',
    date: new Date(Date.now() - 3 * 60 * 60000),
    isRead: false,
    isPriority: false,
    category: 'primary',
    hasAttachments: true,
    hasEvent: true,
    eventDetails: {
      title: 'Réunion équipe - Point projet',
      date: new Date(Date.now() + 2 * 24 * 60 * 60000),
      location: 'Salle de conférence B',
      description: 'Réunion hebdomadaire de suivi de projet.'
    }
  },
  {
    id: 'em5',
    accountId: 'personal',
    subject: 'Nouvelle connexion LinkedIn',
    sender: 'LinkedIn',
    senderEmail: 'notifications@linkedin.com',
    preview: 'Jean Dupont souhaite se connecter avec vous sur LinkedIn.',
    date: new Date(Date.now() - 5 * 60 * 60000),
    isRead: true,
    isPriority: false,
    category: 'social',
    hasAttachments: false,
    hasEvent: false
  },
  {
    id: 'em6',
    accountId: 'personal',
    subject: 'Vente Flash - 50% aujourd\'hui seulement !',
    sender: 'Boutique Mode',
    senderEmail: 'offres@boutique.fr',
    preview: 'Ne manquez pas notre plus grande vente de l\'année !',
    date: new Date(Date.now() - 12 * 60 * 60000),
    isRead: true,
    isPriority: false,
    category: 'promotions',
    hasAttachments: false,
    hasEvent: false
  }
];

export const userPreferences: UserPreference[] = [
  { 
    id: 'p1', 
    type: 'rule',
    description: 'Déplacer tous les emails LinkedIn dans le dossier Social', 
    active: true 
  },
  { 
    id: 'p2', 
    type: 'rule',
    description: 'Marquer les emails du patron comme importants', 
    active: true 
  },
  { 
    id: 'p3', 
    type: 'preference',
    description: 'Envoyer des résumés vocaux pour les emails importants', 
    active: false 
  },
  { 
    id: 'p4', 
    type: 'rule',
    description: 'Supprimer les newsletters Orange après 5 jours', 
    active: true,
    deleteAuthorized: true 
  }
];

export const chatHistory: ChatMessage[] = [
  {
    id: 'msg1',
    content: 'Bonjour ! Je suis votre assistant email. Comment puis-je vous aider aujourd\'hui ?',
    timestamp: new Date(Date.now() - 30 * 60000),
    direction: 'incoming',
    type: 'text',
    read: true
  },
  {
    id: 'msg2',
    content: 'Vous avez 3 nouveaux emails dans votre compte Personnel et 7 nouveaux emails dans votre compte Professionnel.',
    timestamp: new Date(Date.now() - 29 * 60000),
    direction: 'incoming',
    type: 'text',
    read: true
  },
  {
    id: 'msg3',
    content: 'Montre-moi mes emails non lus professionnels',
    timestamp: new Date(Date.now() - 28 * 60000),
    direction: 'outgoing',
    type: 'text',
    read: true
  },
  {
    id: 'msg4',
    content: 'Voici vos emails professionnels non lus :',
    timestamp: new Date(Date.now() - 27 * 60000),
    direction: 'incoming',
    type: 'text',
    read: true
  },
  {
    id: 'msg5',
    content: 'URGENT : Maintenance serveur',
    timestamp: new Date(Date.now() - 27 * 60000),
    direction: 'incoming',
    type: 'email',
    read: true,
    data: emails.find(email => email.id === 'em2')
  },
  {
    id: 'msg6',
    content: 'J\'ai détecté un événement dans cet email. Voulez-vous que je l\'ajoute à votre calendrier ?',
    timestamp: new Date(Date.now() - 26 * 60000),
    direction: 'incoming',
    type: 'suggestion',
    read: true
  },
  {
    id: 'msg7',
    content: 'Oui, ajoute-le s\'il te plaît',
    timestamp: new Date(Date.now() - 25 * 60000),
    direction: 'outgoing',
    type: 'text',
    read: true
  },
  {
    id: 'msg8',
    content: 'Parfait ! J\'ai ajouté "Maintenance Serveur" à votre calendrier pour demain à 23h.',
    timestamp: new Date(Date.now() - 24 * 60000),
    direction: 'incoming',
    type: 'action',
    read: true
  },
  {
    id: 'msg9',
    content: 'Peux-tu me lire l\'email du Dr. Youssef ?',
    timestamp: new Date(Date.now() - 10 * 60000),
    direction: 'outgoing',
    type: 'text',
    read: true
  },
  {
    id: 'msg10',
    content: 'Voici l\'email concernant votre rendez-vous avec Dr. Youssef :',
    timestamp: new Date(Date.now() - 9 * 60000),
    direction: 'incoming',
    type: 'text',
    read: true
  },
  {
    id: 'msg11',
    content: 'Objet : Votre rendez-vous avec Dr. Youssef\n\nCeci est un rappel de votre rendez-vous avec Dr. Youssef demain à 14h au Centre Médical, 123 Rue de la Santé. Merci d\'arriver 15 minutes en avance pour remplir les documents nécessaires.',
    timestamp: new Date(Date.now() - 9 * 60000),
    direction: 'incoming',
    type: 'email',
    read: true,
    data: emails.find(email => email.id === 'em3')
  },
  {
    id: 'msg12',
    content: 'Voulez-vous que je crée une nouvelle règle pour marquer automatiquement tous les emails de rendez-vous comme importants ?',
    timestamp: new Date(Date.now() - 5 * 60000),
    direction: 'incoming',
    type: 'suggestion',
    read: true
  }
];