import { createClient } from '@supabase/supabase-js';
import { EmailRule } from '../types';

// Récupérer les variables d'environnement
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Vérifier que les variables d'environnement sont définies
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variables d\'environnement Supabase manquantes:',
    { hasUrl: !!supabaseUrl, hasKey: !!supabaseAnonKey });
  throw new Error('Missing Supabase environment variables');
}

// Log pour le débogage
console.log('Initialisation du client Supabase avec URL:', 
  supabaseUrl.substring(0, 15) + '...');

// Créer le client Supabase avec des options explicites
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Fonction de test pour vérifier la connexion à Supabase
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Erreur de connexion à Supabase (auth):', error);
      return { connected: false, error };
    }
    
    console.log('Connexion à Supabase établie, session:', 
      data.session ? 'Authentifié' : 'Non authentifié');
    return { connected: true, authenticated: !!data.session };
  } catch (err) {
    console.error('Exception lors de la connexion à Supabase:', err);
    return { connected: false, error: err };
  }
};

// Exécuter le test de connexion au chargement
testSupabaseConnection().then(result => {
  console.log('État initial Supabase:', result);
});

// Fonctions d'authentification améliorées
export const signInWithEmail = async (email: string, password: string) => {
  console.log('Tentative de connexion avec:', email);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    console.log('Résultat auth.signInWithPassword:', { 
      success: !error, 
      hasUser: !!data?.user, 
      hasSession: !!data?.session 
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erreur détaillée de connexion:', error);
    throw error;
  }
};

export const signOut = async () => {
  console.log('Tentative de déconnexion...');
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Erreur lors de la déconnexion:', error);
      throw error;
    }
    console.log('Déconnexion réussie');
    return { success: true };
  } catch (error) {
    console.error('Exception lors de la déconnexion:', error);
    throw error;
  }
};

// Vos fonctions CRUD pour les règles email (inchangées)
export const getRules = async (): Promise<EmailRule[]> => {
  const { data, error } = await supabase
    .from('email_rules')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erreur lors de la récupération des règles:', error);
    throw error;
  }

  return data.map(rule => ({
    id: rule.id,
    name: rule.name,
    condition: rule.condition,
    action: rule.action,
    parameters: rule.parameters,
    isActive: rule.is_active
  }));
};

export const createRule = async (rule: Omit<EmailRule, 'id'>): Promise<EmailRule> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    throw new Error('Utilisateur non authentifié');
  }

  const { data, error } = await supabase
    .from('email_rules')
    .insert([{
      user_id: userData.user.id,
      name: rule.name,
      condition: rule.condition,
      action: rule.action,
      parameters: rule.parameters,
      is_active: rule.isActive
    }])
    .select()
    .single();

  if (error) {
    console.error('Erreur lors de la création de la règle:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    condition: data.condition,
    action: data.action,
    parameters: data.parameters,
    isActive: data.is_active
  };
};

export const updateRule = async (rule: EmailRule): Promise<void> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    throw new Error('Utilisateur non authentifié');
  }

  const { error } = await supabase
    .from('email_rules')
    .update({
      name: rule.name,
      condition: rule.condition,
      action: rule.action,
      parameters: rule.parameters,
      is_active: rule.isActive,
      updated_at: new Date()
    })
    .eq('id', rule.id)
    .eq('user_id', userData.user.id);

  if (error) {
    console.error('Erreur lors de la mise à jour de la règle:', error);
    throw error;
  }
};

export const deleteRule = async (ruleId: string): Promise<void> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    throw new Error('Utilisateur non authentifié');
  }

  const { error } = await supabase
    .from('email_rules')
    .delete()
    .eq('id', ruleId)
    .eq('user_id', userData.user.id);

  if (error) {
    console.error('Erreur lors de la suppression de la règle:', error);
    throw error;
  }
};

export default supabase;