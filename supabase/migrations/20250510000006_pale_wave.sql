/*
  # Email Connection Infrastructure

  1. New Tables
    - `email_connection_sessions`
      - `id` (uuid, primary key)
      - `phone_number` (text, user's WhatsApp number)
      - `session_id` (text, unique connection token)
      - `status` (text, session status)
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for service role access
*/

-- Create the email connection sessions table
CREATE TABLE IF NOT EXISTS email_connection_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  session_id text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_connection_sessions ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_sessions_phone_number 
ON email_connection_sessions(phone_number);

CREATE INDEX IF NOT EXISTS idx_email_sessions_session_id 
ON email_connection_sessions(session_id);

-- Add policy for service role access
CREATE POLICY "Service role can manage email sessions"
  ON email_connection_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_email_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM email_connection_sessions
  WHERE expires_at < NOW();
END;
$$;