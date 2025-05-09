/*
  # Email Credentials Table

  1. New Tables
    - `email_credentials`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `email` (text)
      - `provider` (text)
      - `oauth_token` (text)
      - `oauth_refresh_token` (text)
      - `imap_host` (text)
      - `imap_port` (integer)
      - `smtp_host` (text)
      - `smtp_port` (integer)
      - `encrypted_password` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS email_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  email text NOT NULL,
  provider text NOT NULL,
  oauth_token text,
  oauth_refresh_token text,
  imap_host text,
  imap_port integer,
  smtp_host text,
  smtp_port integer,
  encrypted_password text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint on user_id and email
ALTER TABLE email_credentials ADD CONSTRAINT unique_user_email UNIQUE (user_id, email);

-- Enable RLS
ALTER TABLE email_credentials ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own credentials"
  ON email_credentials
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials"
  ON email_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
  ON email_credentials
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials"
  ON email_credentials
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX idx_email_credentials_user_id ON email_credentials(user_id);
CREATE INDEX idx_email_credentials_email ON email_credentials(email);