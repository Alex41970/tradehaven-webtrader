-- STEP 1: Rollback previous migration - restore direct cascades that were working
-- These were removed in the previous migration but were actually needed
ALTER TABLE public.trades 
ADD CONSTRAINT trades_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_favorites 
ADD CONSTRAINT user_favorites_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- STEP 2: Fix the ROOT CAUSE - trade_execution_log was blocking trade deletion
-- This is why 6@1.com couldn't be deleted (had 203 execution logs)
ALTER TABLE public.trade_execution_log
DROP CONSTRAINT IF EXISTS trade_execution_log_trade_id_fkey;

ALTER TABLE public.trade_execution_log
ADD CONSTRAINT trade_execution_log_trade_id_fkey
FOREIGN KEY (trade_id) REFERENCES public.trades(id) ON DELETE CASCADE;

-- STEP 3: Fix admin_user_relationships duplicate FK issue
-- Remove the direct FK to auth.users (keep only the one through user_profiles)
ALTER TABLE public.admin_user_relationships
DROP CONSTRAINT IF EXISTS admin_user_relationships_user_id_fkey;

-- The constraint fk_admin_user_relationships_user_profiles remains (user_id → user_profiles CASCADE)

-- Add comments explaining the fixed cascade paths
COMMENT ON CONSTRAINT trades_user_id_fkey ON public.trades IS 'Direct cascade from auth.users for user deletion';
COMMENT ON CONSTRAINT trade_execution_log_trade_id_fkey ON public.trade_execution_log IS 'Cascade delete execution logs when trade is deleted';
COMMENT ON TABLE public.admin_user_relationships IS 'Cascade path: auth.users → user_profiles → admin_user_relationships (via fk_admin_user_relationships_user_profiles)';