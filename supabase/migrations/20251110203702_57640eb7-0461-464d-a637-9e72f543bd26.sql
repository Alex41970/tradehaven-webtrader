-- Add activity tracking columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_activity ON user_profiles(last_activity_at);

-- Set initial values for existing users
UPDATE user_profiles 
SET last_login_at = created_at, 
    last_activity_at = created_at 
WHERE last_login_at IS NULL;