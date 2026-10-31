# Architecture rules

- Import the database client from `@/integrations/supabase/client` and use the generated `types.ts`; never hand-edit generated connection or type files.
- Server-trusted money changes (balances, margins, trade settlement) happen inside SECURITY DEFINER database functions; the `prevent_user_financial_updates` trigger blocks only direct edits made as the `authenticated` role, so keep it SECURITY INVOKER.
- Sign-up is invite-only via admin promo codes; `signup_requires_promo()` relaxes this only while no admin exists (first-run bootstrap). Social sign-in is deliberately not offered because it would bypass promo codes.
- Scheduled server work uses managed HTTP schedules with `authenticateCronRequest`; never embed keys or backend URLs in SQL.
- Prices: the scheduled `price-feed` function is the single price source (free providers first, paid fallback capped per run); it writes `assets` + `price_candles` and runs `process_price_triggers()` (SL/TP, margin call, stop-out). Clients poll `assets` and only simulate small, bounded moves around the real price; never let client-simulated prices drive execution.
- P&L and margin are lot-based (`calc_trade_pnl` in SQL, `src/utils/pnlCalculator.ts` in the client); keep both formulas identical. The `trades` insert trigger is the authority for open price and margin.
- Charts are built in-app from `price_candles` (lightweight-charts); don't reintroduce third-party chart feeds that use different prices.
