-- Fix extension security issue by moving extensions out of public schema
-- Create a dedicated extensions schema and move extensions there

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pgcrypto extension to extensions schema (commonly used by Supabase)
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Grant usage on extensions schema to public
GRANT USAGE ON SCHEMA extensions TO public;

-- Create wrapper functions in public schema for commonly used pgcrypto functions
CREATE OR REPLACE FUNCTION public.gen_random_uuid()
RETURNS uuid
LANGUAGE sql
VOLATILE
AS $$
  SELECT extensions.gen_random_uuid();
$$;