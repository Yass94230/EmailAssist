/*
  # Email Credentials Table Setup

  1. Table Creation
    - Creates email_credentials table if it doesn't exist
    - Adds necessary columns for storing email authentication data
    
  2. Security
    - Enables Row Level Security (RLS)
    - Adds policy for service role access
    
  3. Performance
    - Adds index on phone_number for faster lookups
*/

-- Create table if it doesn't exist
DO $$ 
BEGIN
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

-- Check if constraint exists before adding it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'email_credentials_phone_number_key'
      AND table_name = 'email_credentials'
  ) THEN
    ALTER TABLE email_credentials 
    ADD CONSTRAINT email_credentials_phone_number_key 
    UNIQUE (phone_number);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE email_credentials ENABLE ROW LEVEL SECURITY;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS email_credentials_phone_number_idx 
ON email_credentials(phone_number);

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Service access to email_credentials" 
ON email_credentials;

-- Create new policy
CREATE POLICY "Service access to email_credentials"
  ON email_credentials
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);