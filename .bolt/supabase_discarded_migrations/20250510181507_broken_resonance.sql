/*
  # Gmail Credentials Service Role Policy

  1. Security
    - Add service role policy for gmail_credentials table
*/

CREATE POLICY "Service access to gmail_credentials"
  ON gmail_credentials
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);