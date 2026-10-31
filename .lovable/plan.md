# Get TradeHaven working on Lovable Cloud

## What is wrong right now

- The new Cloud database is completely empty: 0 tables, 0 user accounts. The app expects 18 tables (profiles, trades, orders, assets, deposits, withdrawals, bot licenses, promo codes, admin settings, roles, etc.) and about 20 server-side procedures (close trade, admin reset account, admin delete trade, bot license activation, coordinator locks, health checks...). Every page that loads data fails.
- The old backend is unreachable from the preview (sign-in refresh calls to it fail), so old accounts, balances and trades cannot be copied over. Everyone, including you, will need to sign up again.
- The live trading connection (open/close trades, balance updates) is hard-wired to the old backend address, so trading cannot work even after the database exists.
- The 5 server functions (live prices, trading updates, order monitor, user activity, delete user) are not deployed on the new backend.
- The scheduled jobs that run the order monitor (pending orders, SL/TP checks) and the price refresh point to the old backend with an old key embedded.
- The app's type contract is a temporary copy of the old schema; the real generated types are empty.

## What I will do

1. **Rebuild the database** in a handful of consolidated migrations reproducing the final state of the 124 old migration files (not replaying every intermediate step):
   - All 18 tables with their columns, defaults and indexes.
   - Access grants and row-level security on every table (users see only their own data, admins see their managed users).
   - Roles kept in a separate roles table with a safe role-check function.
   - All trading/admin procedures and triggers, including automatic profile creation on sign-up, P&L settlement on close, margin recalculation, account reset, trade deletion, risk settings (margin call 100%, stop-out 50%, grace period).
   - Seed the asset list (crypto, forex, commodities, indices, stocks) with starting prices.
2. **Point the app at the new backend**: replace the hard-coded old address in the trading connection with the current one, and remove the leftover old addresses from code.
3. **Deploy the 5 server functions** to the new backend and confirm each responds.
4. **Recreate the scheduled jobs** (order monitor, price refresh) against the new backend using a protected cron secret instead of an embedded key, keeping the reduced frequencies chosen earlier to control costs.
5. **Switch to the real generated types** once the schema exists, and retire the temporary schema copy.
6. **Sign-in**: keep email/password, add Google sign-in.
7. **Make you admin**: after you sign up again, I assign the admin role to your account.
8. **End-to-end check** while signed in: sign up, see balance, open a trade, watch P&L move, close it, confirm balance updates; open the admin area and check Trading Settings, Reset Account and Delete Trade.

## What you will need to do

- Sign up again in the preview (old accounts and data are gone with the old backend).
- Tell me which email is yours so I give it the admin role.

## Technical details

- Schema source of truth: final state of `supabase/migrations/*` (old ref `stdfkfutgkmnaajixguz`); migrations applied via the migration tool, grouped: (a) enums, roles, profiles + signup trigger, (b) trading tables, (c) payments/bots/promo/admin tables, (d) functions + triggers, (e) RLS + grants, (f) pg_cron/pg_net jobs authenticated by `LOVABLE_CRON_SECRET` (already supported in `_shared/cron-auth.ts`).
- Asset seed inserted via data query, not migration.
- `TradingWebSocketService.ts` wsUrl derived from `VITE_SUPABASE_URL` (`wss://<host>/functions/v1/websocket-trading-updates`).
- After `get_types`, `src/lib/trading-client.ts` re-exports the generated client and `trading-database.types.ts` is removed; AGENTS.md rules updated accordingly.
- External price sources (CoinGecko, Yahoo) need no API keys.
- Run security linter after migrations; fix findings.
