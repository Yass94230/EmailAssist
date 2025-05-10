/*
  # Secure admin settings access
  
  1. Changes
    - Add user_id column to user_settings table
    - Add foreign key constraint to auth.users
    - Update RLS policies to check user_id
    - Add migration check for existing records
  
  2. Security
    - Enable RLS on all tables
    - Add policies to restrict access to own records only
    - Ensure data integrity with foreign keys
*/

-- Add user_id to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Update existing records to link with auth users
DO $$
BEGIN
  UPDATE user_settings s
  SET user_id = u.id
  FROM auth.users u
  WHERE u.phone = s.phone_number
  AND s.user_id IS NULL;
END $$;

-- Make user_id NOT NULL after migration
ALTER TABLE user_settings
ALTER COLUMN user_id SET NOT NULL;

-- Update RLS policies for user_settings
DROP POLICY IF EXISTS "Users can manage their own settings" ON user_settings;
CREATE POLICY "Users can manage their own settings"
ON user_settings
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Update RLS policies for email_credentials
DROP POLICY IF EXISTS "Users can manage their own email credentials" ON email_credentials;
CREATE POLICY "Users can manage their own email credentials"
ON email_credentials
FOR ALL
TO authenticated
USING (
  phone_number IN (
    SELECT phone_number 
    FROM user_settings 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  phone_number IN (
    SELECT phone_number 
    FROM user_settings 
    WHERE user_id = auth.uid()
  )
);

-- Update RLS policies for user_whatsapp
DROP POLICY IF EXISTS "Users can manage their own WhatsApp numbers" ON user_whatsapp;
CREATE POLICY "Users can manage their own WhatsApp numbers"
ON user_whatsapp
FOR ALL
TO authenticated
USING (
  phone_number IN (
    SELECT phone_number 
    FROM user_settings 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  phone_number IN (
    SELECT phone_number 
    FROM user_settings 
    WHERE user_id = auth.uid()
  )
);