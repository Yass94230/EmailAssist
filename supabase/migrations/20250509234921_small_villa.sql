/*
  # Création de la table des identifiants email

  1. Nouvelle Table
    - `email_credentials`
      - `id` (uuid, clé primaire)
      - `session_id` (text, unique)
      - `email` (text)
      - `provider` (text)
      - `config` (jsonb, pour IMAP/SMTP)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Sécurité
    - Active RLS
    - Ajoute des politiques pour le service role
*/

CREATE TABLE IF NOT EXISTS email_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  email text NOT NULL,
  provider text NOT NULL,
  config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_credentials ENABLE ROW LEVEL SECURITY;

-- Politique pour le service role
CREATE POLICY "Service role access"
  ON email_credentials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);