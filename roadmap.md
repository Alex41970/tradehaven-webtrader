# Roadmap — TradeHaven

## Offline buyer release
- [x] Add opt-in obfuscated domain lock without changing the live app
- [x] Test exact-domain enforcement and zero license callbacks
- [x] Document standalone delivery requirements and protection limits
- [ ] Produce and verify buyer release — blocked: buyer domain and buyer-owned service settings not supplied
- [ ] Confirm buyer backend setup (buyer-owned Supabase/Cloud project) and who hosts the frontend — blocked: awaiting Ali's answer

- [x] Rebuild Cloud database, functions, schedules
- [x] Email sign-up; first account without promo code
- [ ] Assign super admin to Ali — blocked: needs Ali's email after sign-up
- [ ] Signed-in end-to-end check (trade, chart) — blocked: needs a confirmed account
- [x] Price feed: free sources first, fallbacks, every minute, own candles
- [x] Server-side SL/TP, margin call, grace, stop-out; server price authority
- [x] Lot-based P&L and margin everywhere
- [x] Own charts replacing TradingView
- [x] Trade-confirmation leak fix, account-switch fix, honest price badge, lazy pages
- [x] One shared account state (balance, credit, trades) for every screen — fixes Equity moving after a close
- [ ] Later: move the remaining separate loaders (deposits, withdrawals, bot status) into the same shared state

- [x] Faster price passes (4/min, 70% provider budget) + ~395 markets

## UI redesign (Midnight + Amber, bento)
- [x] Theme, fonts, app frame, client dashboard, trading layout
- [x] Admin dashboard redesign (sidebar sections, overview charts)
- [x] Landing page + sign-in redesign
- [x] Replace AI-look hero background with professional financial-district photo

## Credit (company money: tradable, not withdrawable)
- [x] Database: credit pot, ledger, single source for equity / free margin / withdrawable
- [x] Rules: credit covers negative balance only when flat; negative-balance setting after that
- [x] Admin: add / remove / set credit with reason, margin-risk confirmation, history
- [x] Withdrawals: credit and margin in use excluded, checked on request and on approval
- [x] Money-integrity gaps found on the way (direct trade edits, double approval, leverage/size checks, duplicate order job)
- [x] Client screens: dashboard, positions, withdraw, wallet activity
- [x] Live-trading service: credit in updates, own-trade check on close
- [x] Tests: account maths (vitest) + database scenarios
- [x] Browser check of client and admin credit screens (desktop and phone)
- [ ] Later: credit expiry dates
- [ ] Later: automatic credit on sign-up or deposit (bonus %), set per promo code
- [ ] Later: option to remove credit automatically when a client withdraws
- [ ] Later: enforce each market's own leverage limit (today every market allows up to 100x)
- [ ] Later: credit history page for admins with filters and export (dialog shows the last 8 entries)
- [x] Admins see what the client can withdraw next to each pending withdrawal request
- [x] Balance shows the total with Own funds and Credit underneath (top bar, dashboard, withdraw)
- [ ] Later: show losses as -$67.37 instead of $-67.37 on the Positions page and trade cards
- [ ] Later: remove the unused `websocket-price-relay` function and old `calculate_pnl` database helpers
