# Architecture rules

- Import the database client from `@/integrations/supabase/client` and use the generated `types.ts`; never hand-edit generated connection or type files.
- Server-trusted money changes (balances, margins, trade settlement) happen inside SECURITY DEFINER database functions; the `prevent_user_financial_updates` trigger blocks only direct edits made as the `authenticated` role, so keep it SECURITY INVOKER.
- Sign-up is invite-only via admin promo codes; `signup_requires_promo()` relaxes this only while no admin exists (first-run bootstrap). Social sign-in is deliberately not offered because it would bypass promo codes.
- Scheduled server work uses managed HTTP schedules with `authenticateCronRequest`; never embed keys or backend URLs in SQL.
