/*
  # Create email folders table

  1. New Tables
    - `email_folders`
      - `id` (uuid, primary key)
      - `name` (text)
      - `label_id` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  2. Security
    - Enable RLS on `email_folders` table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS email_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  label_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_folders ENABLE ROW LEVEL SECURITY;

-- Politique de lecture : les utilisateurs peuvent lire leurs propres dossiers
CREATE POLICY "Users can read own folders"
  ON email_folders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Politique d'insertion : les utilisateurs peuvent créer leurs propres dossiers
CREATE POLICY "Users can create own folders"
  ON email_folders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Politique de mise à jour : les utilisateurs peuvent modifier leurs propres dossiers
CREATE POLICY "Users can update own folders"
  ON email_folders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Politique de suppression : les utilisateurs peuvent supprimer leurs propres dossiers
CREATE POLICY "Users can delete own folders"
  ON email_folders
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);