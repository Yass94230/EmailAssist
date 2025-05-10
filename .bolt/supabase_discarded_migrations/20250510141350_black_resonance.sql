/*
  # Add missing constraints and indexes

  1. Changes
    - Add foreign key constraints for user_id columns
    - Add indexes for frequently queried columns
    - Enable RLS on all tables
    - Add RLS policies for authenticated users
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
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own WhatsApp numbers"
ON user_whatsapp
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own email credentials"
ON email_credentials
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_whatsapp_user_id ON user_whatsapp(user_id);
CREATE INDEX IF NOT EXISTS idx_email_credentials_user_id ON email_credentials(user_id);

-- Add foreign key constraints
ALTER TABLE user_settings
ADD CONSTRAINT fk_user_settings_user
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE user_whatsapp
ADD CONSTRAINT fk_user_whatsapp_user
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE email_credentials
ADD CONSTRAINT fk_email_credentials_user
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;