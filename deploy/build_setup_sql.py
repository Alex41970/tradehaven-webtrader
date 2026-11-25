# Builds deploy/setup_db.sql: one re-runnable script for a fresh backend (from drizzle/migrations + deploy/assets.csv).
import glob, csv, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = []
out.append("""-- =====================================================================
-- Edge Wealth Pro - complete database setup (single run, safe to re-run)
-- Paste everything into Supabase > SQL Editor > New query > Run.
-- It wipes any half-finished earlier attempt, then builds everything fresh.
-- =====================================================================
BEGIN;

-- 1) Stop any old scheduled jobs from earlier attempts
DO $reset$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job;
  END IF;
END
$reset$;

-- 2) Remove leftovers from earlier attempts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, service_role;
SET search_path TO public, extensions;
""")
for f in sorted(glob.glob(ROOT + "/drizzle/migrations/*.sql")):
    s = open(f, encoding="utf-8").read().replace("--> statement-breakpoint", "")
    name = f.rsplit("/",1)[1]
    out.append(f"\n-- ---------- {name} ----------\nSET search_path TO public, extensions;\n{s.rstrip()}\n;\n")
rows = list(csv.DictReader(open(ROOT + "/deploy/assets.csv", encoding="utf-8")))
cols = list(rows[0].keys())
def lit(c, v):
    if v == "": return "NULL"
    if c == "is_active": return "true" if v == "t" else "false"
    if c in ("price","change_24h","min_trade_size","spread","max_leverage","contract_size"): return v
    return "'" + v.replace("'", "''") + "'"
out.append("\n-- ---------- Markets ----------\nSET search_path TO public, extensions;\nDELETE FROM public.assets;\nINSERT INTO public.assets (" + ",".join(cols) + ") VALUES\n" +
  ",\n".join("(" + ",".join(lit(c, r[c]) for c in cols) + ")" for r in rows) + ";\n")
out.append("\nCOMMIT;\n\nSELECT 'SETUP COMPLETE: ' || (SELECT count(*) FROM public.assets) || ' markets loaded' AS result;\n")
open(ROOT + "/deploy/setup_db.sql","w",encoding="utf-8").write("".join(out))
print("ok")
