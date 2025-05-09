import { supabase } from './supabase';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface Folder {
  id: string;
  name: string;
  labelId: string;
}

export const createFolder = async (accessToken: string, name: string): Promise<Folder> => {
  try {
    // Créer le label Gmail
    const response = await fetch(`${GMAIL_API_BASE}/labels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
        type: 'user',
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur lors de la création du dossier: ${response.statusText}`);
    }

    const label = await response.json();

    // Sauvegarder dans Supabase
    const { data, error } = await supabase
      .from('email_folders')
      .insert([{
        name: name,
        label_id: label.id,
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      name: data.name,
      labelId: data.label_id,
    };
  } catch (error) {
    console.error('Erreur lors de la création du dossier:', error);
    throw error;
  }
};

export const getFolders = async (accessToken: string): Promise<Folder[]> => {
  try {
    // Récupérer les labels Gmail
    const response = await fetch(`${GMAIL_API_BASE}/labels`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération des dossiers: ${response.statusText}`);
    }

    const { labels } = await response.json();
    const userLabels = labels.filter((label: any) => label.type === 'user');

    // Synchroniser avec Supabase
    const { data: existingFolders } = await supabase
      .from('email_folders')
      .select('*');

    // Mettre à jour ou créer les dossiers dans Supabase
    const folders: Folder[] = [];
    for (const label of userLabels) {
      const existingFolder = existingFolders?.find(f => f.label_id === label.id);
      
      if (existingFolder) {
        folders.push({
          id: existingFolder.id,
          name: label.name,
          labelId: label.id,
        });
      } else {
        const { data } = await supabase
          .from('email_folders')
          .insert([{
            name: label.name,
            label_id: label.id,
          }])
          .select()
          .single();

        if (data) {
          folders.push({
            id: data.id,
            name: data.name,
            labelId: data.label_id,
          });
        }
      }
    }

    return folders;
  } catch (error) {
    console.error('Erreur lors de la récupération des dossiers:', error);
    throw error;
  }
};

export const moveEmailToFolder = async (
  accessToken: string,
  emailId: string,
  folderId: string
): Promise<void> => {
  try {
    const { data: folder } = await supabase
      .from('email_folders')
      .select('label_id')
      .eq('id', folderId)
      .single();

    if (!folder) {
      throw new Error('Dossier non trouvé');
    }

    const response = await fetch(`${GMAIL_API_BASE}/messages/${emailId}/modify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: [folder.label_id],
        removeLabelIds: ['INBOX'],
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur lors du déplacement de l'email: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Erreur lors du déplacement de l\'email:', error);
    throw error;
  }
};