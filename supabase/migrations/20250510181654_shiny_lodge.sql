/*
  # Update Gmail Credentials Permissions

  1. Changes
    - Add authenticated users policy for Gmail credentials
    - Ensure service role has full access
  
  2. Security
    - Allows authenticated users to manage their own credentials
    - Maintains service role access
*/

-- Add policy for authenticated users to manage their own credentials
CREATE POLICY "Users can manage their own Gmail credentials"
  ON gmail_credentials
  FOR ALL
  TO authenticated
  USING (phone_number IN (
    SELECT phone_number 
    FROM user_settings 
    WHERE user_id = auth.uid()
  ))
  WITH CHECK (phone_number IN (
    SELECT phone_number 
    FROM user_settings 
    WHERE user_id = auth.uid()
  ));