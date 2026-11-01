# Full UI/UX redesign — Midnight + Amber, bento layout

Visual rebuild only. Prices, trading, P&L, margin, and admin rules stay exactly as they are.

## Design direction
- **Colors:** midnight background #0A0E14, surfaces #121822, borders #1F2733, amber accent #F5A524 for main actions and highlights, red #F04452 for losses/sell, plus a calm green for profit/buy. Every color comes from shared theme settings, so nothing is hard-coded.
- **Fonts:** JetBrains Mono for headings, numbers, and prices (digits line up). Work Sans for body text.
- **Layout:** bento cards (rounded panels of different sizes on a grid), thin borders, soft depth, consistent spacing, plus loading placeholders and empty states everywhere.
- **Shared app frame:** a collapsible left sidebar (Dashboard, Trade, Markets, History, Wallet, Admin) and a top bar with the account summary (balance, equity, free margin, margin level), market status, and the profile menu. On phones it becomes a bottom tab bar.

## Phase 1 — Foundation
- New color tokens, fonts, rounded corners, and shadows. Restyle the shared buttons, cards, tabs, tables, inputs, badges, and dialogs.
- Shared building blocks: stat card, mini price chart, change-percentage pill, section header, empty state, and a number display with up/down flash.

## Phase 2 — Client dashboard (new, chart-rich)
Bento grid with:
- Equity hero card with an area chart (equity over time from transactions and closed trades, with 1D/1W/1M/All).
- Balance / Equity / Free margin / Margin level cards, with a margin gauge.
- P&L by day (bar chart), win rate (donut chart), exposure by market type (donut chart).
- Open positions list with live P&L, top movers, a watchlist with mini charts, and recent activity.
- Quick actions: Deposit, Withdraw, Trade.

## Phase 3 — Trading screen
- Three-column workspace: market list on the left (search, category tabs, favorites, mini charts), the existing in-app chart in the middle (restyled to the theme), and the order ticket on the right (Buy/Sell toggle, lots, leverage, SL/TP, margin preview).
- Bottom panel: Positions / Orders / History tabs in a compact, readable table.
- Phone: chart first, slide-up order sheet.

## Phase 4 — Admin dashboard
- Sidebar sections replace the crowded tabs: Overview, Users, Trades, Price Feed, Risk & Trading Settings, Promo Codes, Payments, Bots, System Health.
- Overview bento: user count, deposits, open exposure, platform P&L, signup and volume charts, feed health.
- Users and trades in proper searchable, sortable tables with side panels for details and actions (reset, delete trade, edit balance).

## Phase 5 — Public site and sign-in
- New landing page: hero with a live market preview, a live ticker strip, feature bento, markets showcase, trust section, and footer.
- Split-screen sign-in and sign-up with the promo code field.
- Info pages (About, Terms, etc.) use one clean reading layout.

## Technical details
- Stack: shadcn/ui (already installed) + Recharts for dashboard charts. lightweight-charts stays for the trading chart (in-app candles, per AGENTS.md). Add `@fontsource` packages for JetBrains Mono and Work Sans, and use framer-motion lightly for transitions.
- Tokens in `src/index.css` and `tailwind.config.ts` (HSL), with `--success`, `--warning`, and chart palette tokens `--chart-1..5`. Remove old hard-coded color classes across components.
- New `src/components/layout/` (AppShell, AppSidebar, TopBar, MobileNav) and `src/components/dashboard/` widgets. Existing hooks (PriceContext, useTrades, useSharedUserProfile, useRealtimePnL, pnlCalculator) are reused as they are, with no logic changes.
- Equity history is derived on the client from existing transactions and closed trades, so no database changes are needed.
- Built phase by phase, with a screenshot check after each one while signed in as the test account.
