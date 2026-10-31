# Roadmap — TradeHaven on Lovable Cloud

- [x] Rebuild database schema (tables, RLS, grants, functions, triggers) on Cloud
- [x] Seed assets
- [x] Point trading connection at new backend; remove old addresses
- [x] Deploy 5 server functions
- [x] Recreate scheduled jobs (order monitor every minute; prices refresh while users are online)
- [x] Switch to generated types; retire temporary schema copy
- [x] Email sign-up/sign-in enabled; first account can sign up without promo code
- [~] Google sign-in — skipped: would bypass invite-only promo codes
- [ ] Assign super admin to Ali — blocked: needs Ali's email after he signs up and confirms
- [ ] End-to-end check signed in — blocked: needs a confirmed account
