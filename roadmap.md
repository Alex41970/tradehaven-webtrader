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
- [ ] Later: merge duplicate data loading into one shared cache (larger refactor)

- [x] Faster price passes (4/min, 70% provider budget) + ~395 markets

## UI redesign (Midnight + Amber, bento)
- [x] Theme, fonts, app frame, client dashboard, trading layout
- [x] Admin dashboard redesign (sidebar sections, overview charts)
- [x] Landing page + sign-in redesign
- [x] Replace AI-look hero background with professional financial-district photo

## Credit (company money: tradable, not withdrawable)
- [ ] Database: credit pot, ledger, single source for equity / free margin / withdrawable
- [ ] Rules: credit covers negative balance only when flat; negative-balance setting after that
- [ ] Admin: add / remove / set credit with reason, margin-risk confirmation, history
- [ ] Withdrawals: credit and margin in use excluded, checked on request and on approval
- [ ] Money-integrity gaps found on the way (direct trade edits, double approval, leverage/size checks, duplicate order job)
- [ ] Client screens: dashboard, trade ticket, positions, withdraw, wallet activity
- [ ] Live-trading service: credit in updates, own-trade check on close
- [ ] Tests: account maths (vitest) + database scenarios + browser check
- [ ] Later: credit expiry dates
- [ ] Later: automatic credit on sign-up or deposit (bonus %), set per promo code
- [ ] Later: option to remove credit automatically when a client withdraws
- [ ] Later: enforce each market's own leverage limit (today every market allows up to 100x)
