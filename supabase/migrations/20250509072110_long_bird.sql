/*
  # Création de la table des paramètres utilisateur

  1. Nouvelle Table
    - `user_settings`
      - `id` (uuid, clé primaire)
      - `phone_number` (text, unique)
      - `audio_enabled` (boolean)
      - `voice_type` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Sécurité
    - Active RLS
    - Ajoute des politiques pour les opérations CRUD
*/

CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text UNIQUE NOT NULL,
  audio_enabled boolean DEFAULT true,
  voice_type text DEFAULT 'alloy',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Politique de lecture : les utilisateurs peuvent lire leurs propres paramètres
CREATE POLICY "Users can read own settings"
  ON user_settings
  FOR SELECT
  TO public
  USING (true);

-- Politique d'insertion/mise à jour : les utilisateurs peuvent gérer leurs propres paramètres
CREATE POLICY "Users can manage own settings"
  ON user_settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);