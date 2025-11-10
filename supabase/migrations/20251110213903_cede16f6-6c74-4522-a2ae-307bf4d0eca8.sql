-- Remove unused last_login_at column from user_profiles table
-- This column is no longer needed as we only track last_activity_at

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS last_login_at;