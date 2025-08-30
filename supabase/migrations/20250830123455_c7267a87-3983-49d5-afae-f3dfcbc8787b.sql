-- Move pg_net extension to extensions schema
-- pg_net is used for HTTP requests and cron jobs
ALTER EXTENSION pg_net SET SCHEMA extensions;

-- Ensure proper grants for the moved extension
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;