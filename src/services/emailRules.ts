import { EmailMessage, EmailRule } from '../types';
import { getRules } from './supabase';
import { createFolder, getFolders, moveEmailToFolder } from './folders';

const evaluateCondition = (email: EmailMessage, condition: string): boolean => {
  try {
    // Créer un contexte sécurisé pour l'évaluation
    const context = {
      subject: email.subject.toLowerCase(),
      sender: email.sender.toLowerCase(),
      senderEmail: email.senderEmail.toLowerCase(),
      isRead: email.isRead,
      hasAttachments: email.hasAttachments
    };
    
    // Évaluer la condition dans le contexte
    return new Function(...Object.keys(context), `return ${condition}`)(...Object.values(context));
  } catch (error) {
    console.error('Erreur lors de l\'évaluation de la condition:', error);
    return false;
  }
};

export const applyRules = async (email: EmailMessage, accessToken: string): Promise<void> => {
  try {
    // Récupérer les règles actives depuis Supabase
    const rules = await getRules();
    const activeRules = rules.filter(rule => rule.isActive);
    const folders = await getFolders(accessToken);
    
    for (const rule of activeRules) {
      if (evaluateCondition(email, rule.condition)) {
        try {
          switch (rule.action) {
            case 'markAsImportant':
              await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  addLabelIds: ['IMPORTANT'],
                  removeLabelIds: []
                })
              });
              break;
              
            case 'moveToFolder':
              if (rule.parameters?.folderName) {
                // Vérifier si le dossier existe
                let folder = folders.find(f => f.name.toLowerCase() === rule.parameters?.folderName?.toLowerCase());
                
                // Créer le dossier s'il n'existe pas
                if (!folder) {
                  folder = await createFolder(accessToken, rule.parameters.folderName);
                }
                
                // Déplacer l'email
                await moveEmailToFolder(accessToken, email.id, folder.id);
              }
              break;
              
            case 'markAsRead':
              await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  removeLabelIds: ['UNREAD']
                })
              });
              break;
          }
          
          console.log(`Règle appliquée avec succès: ${rule.name}`);
        } catch (error) {
          console.error(`Erreur lors de l'application de la règle ${rule.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des règles:', error);
  }
};