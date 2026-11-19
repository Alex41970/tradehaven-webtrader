# Closed markets: grayed out with "Opens at ..." message

## What users will see
- In the market list, closed markets (US stocks, indices, forex at weekends, etc.) look grayed out with a small "Closed" tag. Crypto stays normal (24/7).
- On the chart of a closed market, a calm banner: **"Market closed - opens Mon 15:30"** (shown in the user's own local time), or "Opens in 2h 15m" when it's less than a day away.
- Buy/Sell buttons on a closed market are grayed and read **"Market closed"**; tapping does nothing. Order form shows the same message. Works the same on phones (pinned Buy/Sell bar).
- Prices of closed markets stay at the last close (no fake movement), which is already how it works.

## Trading hours used (standard exchange times)
- Crypto: always open
- US stocks and US indices: Mon-Fri 09:30-16:00 New York time
- Forex: Sun 17:00 - Fri 17:00 New York time
- Commodities (gold, oil, etc.): Sun 18:00 - Fri 17:00 New York time, daily break 17:00-18:00
- Non-US indices: their own exchange hours (e.g. DAX 09:00-17:30 Frankfurt)
- Public holidays are not included in this first version.

The existing admin "market closed" switch and scheduled trading hours keep working on top of this.

## Technical details
- New `src/utils/marketHours.ts`: `getMarketSession(asset, now)` -> `{ open, nextOpen }`, timezone-aware via `Intl`, by asset category/symbol; vitest tests for weekend, after-hours and crypto cases.
- Use it in the market list (WebTrader + phone list), `TradingChart` banner, `EnhancedTradingPanel` and phone Buy/Sell bar; disable order submit when closed.
- Server side: the `trades` insert trigger rejects new market orders on a closed market (same rules mirrored in SQL) so it can't be bypassed.
