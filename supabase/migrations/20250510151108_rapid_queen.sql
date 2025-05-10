/*
  # Email Connection Sessions

  1. New Tables
    - `email_connection_sessions`
      - `id` (uuid, primary key)
      - `phone_number` (text)
      - `session_id` (text, unique)
      - `status` (text, default 'pending')
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Index on phone_number for faster lookups
    - Index on session_id for faster lookups

  3. Security
    - Enable RLS
    - Add policy for service role access
*/

-- Create email_connection_sessions table
CREATE TABLE IF NOT EXISTS email_connection_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  session_id text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_email_sessions_phone_number ON email_connection_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_email_sessions_session_id ON email_connection_sessions(session_id);

-- Enable RLS
ALTER TABLE email_connection_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Service role can manage email sessions" ON email_connection_sessions;

-- Add RLS policy for service role
CREATE POLICY "Service role can manage email sessions"
ON email_connection_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);