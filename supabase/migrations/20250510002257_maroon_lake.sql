/*
  # Email Credentials Table

  1. New Tables
    - `email_credentials`
      - `id` (serial, primary key)
      - `phone_number` (text, unique)
      - `email` (text)
      - `app_password` (text)
      - `provider` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policy for public access
    
  3. Indexes
    - Index on phone_number for faster lookups
*/

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS email_credentials (
    id SERIAL PRIMARY KEY,
    phone_number text NOT NULL,
    email text NOT NULL,
    app_password text NOT NULL,
    provider text NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Add unique constraint on phone_number if it doesn't exist
DO $$ BEGIN
  ALTER TABLE email_credentials ADD CONSTRAINT email_credentials_phone_number_key UNIQUE (phone_number);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE email_credentials ENABLE ROW LEVEL SECURITY;

-- Add index if it doesn't exist
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS email_credentials_phone_number_idx ON email_credentials(phone_number);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Drop existing policy if it exists and create new one
DO $$ BEGIN
  DROP POLICY IF EXISTS "Service access to email_credentials" ON email_credentials;
  
  CREATE POLICY "Service access to email_credentials"
    ON email_credentials
    FOR ALL
    TO public
    USING (true);
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;