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

-- Add RLS policy for service role
CREATE POLICY "Service role can manage email sessions"
ON email_connection_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);