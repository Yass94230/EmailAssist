// Vérification du fichier services/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variables d\'environnement Supabase manquantes:',
    { hasUrl: !!supabaseUrl, hasKey: !!supabaseAnonKey });
  throw new Error('Configuration Supabase incomplète. Vérifiez vos variables d\'environnement.');
}

console.log('Initialisation du client Supabase avec:', 
  { url: supabaseUrl.substring(0, 10) + '...', key: supabaseAnonKey.substring(0, 5) + '...' });

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'supabase.auth.token',
  }
});

// Fonction de test pour vérifier la connexion à Supabase
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('user_settings').select('count(*)', { count: 'exact' });
    
    if (error) {
      console.error('Erreur de connexion à Supabase:', error);
      return { connected: false, error };
    }
    
    console.log('Connexion à Supabase réussie:', data);
    return { connected: true, data };
  } catch (err) {
    console.error('Exception lors de la connexion à Supabase:', err);
    return { connected: false, error: err };
  }
};

// Tester la connexion immédiatement
testSupabaseConnection().then(result => {
  console.log('Test de connexion Supabase:', result);
});

export default supabase;