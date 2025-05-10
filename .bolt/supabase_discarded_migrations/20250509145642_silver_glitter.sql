/*
  # Ajout de la table gmail_credentials

  1. Nouvelle Table
    - `gmail_credentials`
      - `id` (serial, clé primaire)
      - `phone_number` (text, unique)
      - `email` (text)
      - `access_token` (text)
      - `refresh_token` (text)
      - `token_expires_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Sécurité
    - Active RLS
    - Ajoute une politique pour le service role
*/

CREATE TABLE IF NOT EXISTS gmail_credentials (
  id serial PRIMARY KEY,
  phone_number text UNIQUE NOT NULL,
  email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gmail_credentials ENABLE ROW LEVEL SECURITY;

-- Politique pour le service role
CREATE POLICY "Service access to gmail_credentials"
  ON gmail_credentials
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);