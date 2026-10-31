# Fill every chart with real market history, now

## Why the charts are still empty
History is loaded at only 4 markets a minute, and the check that decides which market goes next keeps picking ones that are already filled. Apple, Bitcoin, Gold and EUR/USD still have only 8 candles (about 35 minutes). No fake or demo data will be added. Every candle will be a real past price.

## What changes
1. **One-time full history load for all 71 markets, run right away**
   - Crypto: real 5-minute candles from Binance for the last 30 days, using real open/high/low/close.
   - Forex, metals, oil, indices, stocks: real 5-minute candles from Yahoo for the last 30 days, also with real open/high/low/close. Today only closing prices are used, which makes the candles look flat.
   - Runs in batches until every market is filled, then reports how many candles each market has.
2. **Fix the automatic top-up** so any market missing history (for example, a newly added one) gets filled within a minute, and markets that are already filled are skipped.
3. **Fast loading on longer timeframes**: the server builds the 1H/4H/1D candles itself and sends a few hundred bars instead of thousands of raw rows, so 30 days of data opens instantly.
4. **Chart opens on a sensible zoom** (about the last 150 bars) and tells you when a market is closed, for example stocks at night or forex at weekends, instead of looking broken.

## Result
Every market opens with about 30 days of real price history on every timeframe, and the newest candle keeps moving with the live price.

## Technical details
- New function action `price-feed` with body `{"mode":"backfill"}` (cron-authenticated). It loops over the assets: Binance `klines` 5m with `startTime` paging (1000 per call, about 9 calls for 30 days), and Yahoo `v8/finance/chart?interval=5m&range=60d` per symbol with real OHLC arrays. Upserts go through `backfill_candles`, which never overwrites live buckets. It is triggered once by a temporary schedule, then that schedule is removed.
- The per-minute check uses a single SQL helper `symbols_missing_history(_since)` instead of the broken per-symbol count, and fills up to 6 markets per run.
- New RPC `get_candles(_symbol, _seconds, _since)` aggregates with `date_bin` and returns OHLC; `TradingChart` uses it instead of paging raw rows.
- Keep 30-day retention (about 600k rows in total, which is fine).
