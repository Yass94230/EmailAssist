/*
  # Add unique constraint to user_whatsapp table
  
  1. Changes
    - Add unique constraint on phone_number column in user_whatsapp table
    
  2. Security
    - No changes to RLS policies
*/

-- Add unique constraint on phone_number
ALTER TABLE user_whatsapp
ADD CONSTRAINT user_whatsapp_phone_number_key UNIQUE (phone_number);