-- Fix the newly created wrapper function to include search_path protection
CREATE OR REPLACE FUNCTION public.gen_random_uuid()
RETURNS uuid
LANGUAGE sql
VOLATILE
SET search_path = 'public'
AS $$
  SELECT extensions.gen_random_uuid();
$$;