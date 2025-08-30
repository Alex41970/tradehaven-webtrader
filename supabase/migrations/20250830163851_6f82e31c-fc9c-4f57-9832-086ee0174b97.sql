-- Fix margin inconsistencies by recalculating all user margins
-- This will ensure the database reflects the correct margin values

-- First, let's recalculate margins for all users to fix current inconsistencies
SELECT public.recalculate_all_user_margins();

-- Ensure the fix-user-margins edge function can be called for real-time updates
-- (This function already exists and will be used by WebSocket for real-time margin fixes)