# Closed markets: grayed out, pending orders only

## What users will see
- **Market list:** closed markets (US stocks, indices, forex at weekends, etc.) are grayed out with a small "Closed" tag. Crypto stays normal (24/7).
- **Chart:** a calm banner: **"Market closed - opens Mon 15:30. You can place a pending order now."** Time shown in the user's own local time ("Opens in 2h 15m" when under a day).
- **Order form on a closed market:** the instant Buy/Sell buttons are grayed and read "Market closed". The form switches to **Pending order**: user picks Buy Limit / Sell Limit / Buy Stop / Sell Stop, a target price, lots, SL/TP. Button reads "Place pending order".
- Same on phones (the pinned Buy/Sell bar opens the pending-order sheet).
- **Pending orders list** in the trades panel: see and cancel waiting orders.
- When the market opens and the price reaches the target, the order fills automatically at the real price. No pre-market or after-hours trading.

## Trading hours used (standard exchange times)
- Crypto: always open
- US stocks and US indices: Mon-Fri 09:30-16:00 New York time
- Forex: Sun 17:00 - Fri 17:00 New York time
- Commodities: Sun 18:00 - Fri 17:00 New York time, daily break 17:00-18:00
- Non-US indices: their own exchange hours
- Public holidays not included in this first version.

The admin "market closed" switch and scheduled trading hours keep working on top of this.

## Technical details
- New `src/utils/marketHours.ts`: `getMarketSession(asset, now)` -> `{ open, nextOpen }` via `Intl` timezones; vitest tests (weekend, after close, crypto).
- First step: verify the existing orders table (has `order_type`) and whether anything executes it; reuse or extend it with `status pending|filled|cancelled`, `trigger_price`, SL/TP, lots, RLS per user.
- Execution in the server: `process_price_triggers()` (run by `price-feed`) fills pending orders against real server prices only when the market is open, reserving margin through the existing trade insert trigger; rejected if not enough free margin (order marked cancelled with reason).
- `trades` insert trigger rejects instant market orders on a closed market, mirroring the same hours in SQL.
- UI: market list, `TradingChart` banner, `EnhancedTradingPanel` + phone sheet, pending-orders tab in `TradingTabsInterface`.
