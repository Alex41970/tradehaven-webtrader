-- Add foreign key constraints to establish relationships for PostgREST joins

-- Add foreign key constraint for deposit_requests -> user_profiles
ALTER TABLE public.deposit_requests
ADD CONSTRAINT fk_deposit_requests_user_profiles
FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
ON DELETE CASCADE;

-- Add foreign key constraint for withdrawal_requests -> user_profiles  
ALTER TABLE public.withdrawal_requests
ADD CONSTRAINT fk_withdrawal_requests_user_profiles
FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
ON DELETE CASCADE;

-- Add foreign key constraint for trades -> user_profiles (if not exists)
ALTER TABLE public.trades
ADD CONSTRAINT fk_trades_user_profiles
FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
ON DELETE CASCADE;

-- Add foreign key constraint for user_bot_status -> user_profiles
ALTER TABLE public.user_bot_status
ADD CONSTRAINT fk_user_bot_status_user_profiles
FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
ON DELETE CASCADE;

-- Add foreign key constraint for admin_user_relationships -> user_profiles
ALTER TABLE public.admin_user_relationships
ADD CONSTRAINT fk_admin_user_relationships_user_profiles
FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
ON DELETE CASCADE;

-- Add foreign key constraint for user_favorites -> user_profiles
ALTER TABLE public.user_favorites
ADD CONSTRAINT fk_user_favorites_user_profiles
FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
ON DELETE CASCADE;