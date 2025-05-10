/*
  # Create email credentials table

  1. New Tables
    - `email_credentials`
      - `id` (integer, primary key)
      - `phone_number` (text)
      - `email` (text)
      - `app_password` (text)
      - `provider` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for service role access
*/

CREATE TABLE IF NOT EXISTS email_credentials (
  id SERIAL PRIMARY KEY,
  phone_number text NOT NULL,
  email text NOT NULL,
  app_password text NOT NULL,
  provider text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

-- Add unique constraint on phone_number
ALTER TABLE email_credentials ADD CONSTRAINT email_credentials_phone_number_key UNIQUE (phone_number);

-- Enable RLS
ALTER TABLE email_credentials ENABLE ROW LEVEL SECURITY;

-- Add indexes
CREATE INDEX email_credentials_phone_number_idx ON email_credentials(phone_number);

-- Policies for service role access
CREATE POLICY "Service access to email_credentials"
  ON email_credentials
  FOR ALL
  TO public
  USING (true);