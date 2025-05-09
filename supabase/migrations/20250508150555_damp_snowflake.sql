/*
  # Création de la table des règles email

  1. Nouvelle Table
    - `email_rules`
      - `id` (uuid, clé primaire)
      - `user_id` (uuid, lié à auth.users)
      - `name` (text, nom de la règle)
      - `condition` (text, condition à évaluer)
      - `action` (text, action à effectuer)
      - `parameters` (jsonb, paramètres de l'action)
      - `is_active` (boolean, statut de la règle)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Sécurité
    - Active RLS
    - Ajoute des politiques pour les opérations CRUD
*/

CREATE TABLE IF NOT EXISTS email_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  condition text NOT NULL,
  action text NOT NULL,
  parameters jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_rules ENABLE ROW LEVEL SECURITY;

-- Politique de lecture : les utilisateurs peuvent lire leurs propres règles
CREATE POLICY "Users can read own rules"
  ON email_rules
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Politique d'insertion : les utilisateurs peuvent créer leurs propres règles
CREATE POLICY "Users can create own rules"
  ON email_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Politique de mise à jour : les utilisateurs peuvent modifier leurs propres règles
CREATE POLICY "Users can update own rules"
  ON email_rules
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Politique de suppression : les utilisateurs peuvent supprimer leurs propres règles
CREATE POLICY "Users can delete own rules"
  ON email_rules
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);