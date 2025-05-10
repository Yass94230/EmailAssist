// Modification du fichier services/auth.ts
import { supabase } from './supabase';

export async function signInWithEmail(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
}

export async function signUpWithEmail(email: string, password: string, phoneNumber?: string) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          phone: phoneNumber,
          email_confirmed: true // Auto-confirmation pour développement
        }
      }
    });

    if (error) throw error;
    
    // Sauvegarder le numéro de téléphone pour un accès facile
    if (data?.user && phoneNumber) {
      localStorage.setItem('userWhatsAppNumber', phoneNumber);
      
      // Créer les paramètres utilisateur par défaut
      await supabase
        .from('user_settings')
        .insert({
          user_id: data.user.id,
          phone_number: phoneNumber,
          audio_enabled: true,
          voice_recognition_enabled: true,
          voice_type: 'alloy'
        });
    }
    
    return data;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    // Supprimer les informations locales
    localStorage.removeItem('userWhatsAppNumber');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Récupère les informations de l'utilisateur actuel, y compris le numéro de téléphone
export async function getUserProfile() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    
    if (data.user) {
      return {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone || localStorage.getItem('userWhatsAppNumber'),
        created_at: data.user.created_at
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}