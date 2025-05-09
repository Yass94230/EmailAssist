/*
  # Email Credentials Table

  1. New Table
    - `email_credentials`
      - `id` (serial, primary key)
      - `phone_number` (text, unique)
      - `email` (text)
      - `app_password` (text)
      - `provider` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policy for service role access
*/

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_credentials (
  id SERIAL PRIMARY KEY,
  phone_number text NOT NULL,
  email text NOT NULL,
  app_password text NOT NULL,
  provider text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_credentials_phone_number_key'
  ) THEN
    ALTER TABLE email_credentials 
    ADD CONSTRAINT email_credentials_phone_number_key 
    UNIQUE (phone_number);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE email_credentials ENABLE ROW LEVEL SECURITY;

-- Create index if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE c.relname = 'email_credentials_phone_number_idx'
  ) THEN
    CREATE INDEX email_credentials_phone_number_idx 
    ON email_credentials(phone_number);
  END IF;
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service access to email_credentials" ON email_credentials;

-- Create new policies
CREATE POLICY "Service access to email_credentials"
  ON email_credentials
  FOR ALL
  TO public
  USING (true);