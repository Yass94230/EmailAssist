import { createClient } from '@supabase/supabase-js';
import { EmailRule } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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