/*
  # Fix WhatsApp RLS policies

  1. Changes
    - Update RLS policies for user_whatsapp table to properly handle user-specific access
    - Ensure users can only manage their own WhatsApp numbers
    - Service role retains full access for system operations

  2. Security
    - Enable RLS on user_whatsapp table
    - Add policies for authenticated users to manage their own numbers
    - Maintain service role access for system operations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Service role can manage WhatsApp numbers" ON user_whatsapp;
DROP POLICY IF EXISTS "Users can insert their own WhatsApp numbers" ON user_whatsapp;
DROP POLICY IF EXISTS "Users can update their own WhatsApp numbers" ON user_whatsapp;
DROP POLICY IF EXISTS "Users can view their own WhatsApp numbers" ON user_whatsapp;

-- Create new policies
CREATE POLICY "Service role can manage WhatsApp numbers"
ON user_whatsapp FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can manage their own WhatsApp numbers"
ON user_whatsapp FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE user_whatsapp ENABLE ROW LEVEL SECURITY;