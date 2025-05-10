/*
  # Security and Performance Improvements

  1. Changes
    - Enable RLS on all tables
    - Add RLS policies for user data access
    - Add performance indexes
    - Add foreign key relationships between tables
  
  2. Security
    - Enable Row Level Security on all tables
    - Add policies to restrict access to authenticated users
    - Users can only access their own data based on phone number
  
  3. Performance
    - Add indexes on frequently queried phone_number columns
*/

-- Enable RLS on all tables
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_credentials ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can manage their own settings"
ON user_settings
FOR ALL
TO authenticated
USING (phone_number = auth.jwt()->>'phone_number')
WITH CHECK (phone_number = auth.jwt()->>'phone_number');

CREATE POLICY "Users can manage their own WhatsApp numbers"
ON user_whatsapp
FOR ALL
TO authenticated
USING (phone_number = auth.jwt()->>'phone_number')
WITH CHECK (phone_number = auth.jwt()->>'phone_number');

CREATE POLICY "Users can manage their own email credentials"
ON email_credentials
FOR ALL
TO authenticated
USING (phone_number = auth.jwt()->>'phone_number')
WITH CHECK (phone_number = auth.jwt()->>'phone_number');

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_settings_phone ON user_settings(phone_number);
CREATE INDEX IF NOT EXISTS idx_user_whatsapp_phone ON user_whatsapp(phone_number);
CREATE INDEX IF NOT EXISTS idx_email_credentials_phone ON email_credentials(phone_number);

-- Ensure user_settings records exist before adding foreign keys
INSERT INTO user_settings (phone_number, audio_enabled, voice_type)
SELECT DISTINCT phone_number, true, 'alloy'
FROM user_whatsapp
WHERE NOT EXISTS (
  SELECT 1 FROM user_settings s 
  WHERE s.phone_number = user_whatsapp.phone_number
);

-- Add foreign key constraints between related tables
ALTER TABLE user_whatsapp
ADD CONSTRAINT fk_whatsapp_settings
FOREIGN KEY (phone_number)
REFERENCES user_settings(phone_number)
ON DELETE CASCADE;

ALTER TABLE email_credentials
ADD CONSTRAINT fk_email_settings
FOREIGN KEY (phone_number)
REFERENCES user_settings(phone_number)
ON DELETE CASCADE;