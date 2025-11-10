-- Drop duplicate foreign key from trades table that references auth.users directly
ALTER TABLE public.trades 
DROP CONSTRAINT IF EXISTS trades_user_id_fkey;

-- Drop duplicate foreign key from user_favorites table that references auth.users directly
ALTER TABLE public.user_favorites 
DROP CONSTRAINT IF EXISTS user_favorites_user_id_fkey;

-- Fix admin_id foreign key to handle admin deletion gracefully
ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_admin_id_fkey;

ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_admin_id_fkey
FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add comment explaining the cascade path
COMMENT ON TABLE public.user_profiles IS 'User deletion cascade path: auth.users -> user_profiles -> all other tables';