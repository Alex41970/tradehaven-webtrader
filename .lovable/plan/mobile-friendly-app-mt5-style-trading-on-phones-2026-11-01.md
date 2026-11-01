# Mobile-friendly app (MT5-style trading on phones)

## Current problems
- Phone bottom bar shows only the first 5 menu items, so Journal, Trading Bot and Deposit can't be reached.
- Trade screen on phones stacks the desktop panels (market list, chart, ticket) into one long page.
- Wide tables (history, positions, admin) overflow on small screens.

## Design (based on MT5 mobile, eToro, Capital.com)

### 1. Phone navigation
- Bottom bar: Quotes, Chart/Trade, Positions, History, More.
- "More" opens a bottom sheet with Overview, Markets, Journal, Trading Bot, Deposit, settings and sign out.
- Top bar on phones: balance/equity summary that expands on tap; Deposit button kept.

### 2. Trade screen on phones (MT5 flow)
- **Quotes**: full-screen market list with search, category chips, watchlists, big tap rows (price + change). Tap a market to open its chart.
- **Chart**: full-width chart with timeframe and indicator controls in a scrollable strip; Alert button kept.
- **One-tap bar** pinned at the bottom of the chart: red SELL / green BUY with live price, lot stepper in the middle (like MT5 one-click trading).
- **Order sheet**: tapping "New order" (or long-press BUY/SELL) slides up a bottom sheet with order type, volume, leverage, stop loss / take profit, margin required, then a big confirm button.
- Sentiment shown under the chart, collapsible.

### 3. Positions on phones
- Header strip: Balance, Equity, Free margin, Margin level, total P&L.
- Each open trade as a card; tap to expand with SL/TP edit and a Close button; swipe-free so it works everywhere.
- Pending orders as a second tab.

### 4. Rest of the app
- History, Journal, Markets heatmap, Trading Bot, Deposit/withdraw dialogs: cards instead of wide tables, dialogs become bottom sheets on phones.
- Admin pages: horizontal scroll for tables plus stacked cards for users/trades so every admin action is usable.
- Landing and sign-in pages: check and fix spacing at 375px width.
- Tap targets at least 44px, safe-area padding for iPhone notch/home bar.

### 5. Testing
- Check every screen at 375px and 414px widths on the 1@1.com account: open a trade from the one-tap bar, open one from the order sheet with SL/TP, close it, deposit dialog, bot screen.

## Technical details
- AppShell: phone nav config with `mobilePrimary` items + "More" sheet (shadcn Sheet/Drawer).
- WebTrader: `useIsMobile` branch rendering a `MobileTrader` with Quotes / Chart views, `MobileTradeBar` (reuses `QuickTradePanel` logic and `handleTrade`) and `OrderSheet` (wraps `EnhancedTradingPanel` in a Drawer).
- Responsive Dialog wrapper that renders a Drawer under 768px for deposit/withdraw/order dialogs.
- No money or trade logic changes; same `openTrade`/`createOrder` paths.
- Existing mobile pages (`MobilePortfolio`, `MobileTradingHistory`) reviewed and folded into the new views or removed if unused.
