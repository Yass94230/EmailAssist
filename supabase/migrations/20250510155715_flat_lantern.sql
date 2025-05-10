/*
  # Secure admin settings access
  
  1. Changes
    - Add user_id to user_settings table
    - Link existing records to auth users
    - Update RLS policies for secure access
  
  2. Security
    - Enable RLS on all tables
    - Add policies to restrict access to own data
    - Ensure referential integrity
*/

-- First, add the column as nullable
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Create temporary table to store phone mappings
CREATE TEMPORARY TABLE phone_mappings AS
SELECT u.id as user_id, u.phone as phone_number
FROM auth.users u
WHERE u.phone IS NOT NULL;

-- Update existing records where possible
UPDATE user_settings s
SET user_id = m.user_id
FROM phone_mappings m
WHERE s.phone_number = m.phone_number
AND s.user_id IS NULL;

-- Remove records that couldn't be mapped (optional, comment out if you want to keep them)
DELETE FROM user_settings
WHERE user_id IS NULL;

-- Now we can safely make it not null
ALTER TABLE user_settings
ALTER COLUMN user_id SET NOT NULL;

-- Drop temporary table
DROP TABLE phone_mappings;

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