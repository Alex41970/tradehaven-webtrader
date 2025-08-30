-- Check what extensions are still in public schema and move them
-- Query to see what extensions exist in public
SELECT extname, nspname as schema_name
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE nspname = 'public';

-- Move any remaining extensions to extensions schema
-- Check and move uuid-ossp if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
    END IF;
END $$;

-- Check and move any other common extensions that might be there
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgjwt') THEN
        ALTER EXTENSION pgjwt SET SCHEMA extensions;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
        -- This extension should remain in public as it's monitoring related
        NULL;
    END IF;
END $$;