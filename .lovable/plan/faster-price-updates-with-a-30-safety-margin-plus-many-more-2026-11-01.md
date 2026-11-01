# Faster price updates with a 30% safety margin, plus many more markets

## Today
- 71 active markets: 24 crypto, 20 forex, 13 stocks, 8 indices, 6 commodities (29 more crypto are switched off).
- The price job runs once a minute. Crypto comes from Binance, everything else from Yahoo, and Twelve Data (8 calls/min) is the backup.
- Screens check for new prices every 30s, so the server can't get prices to users faster than that.

## Provider limits, and the 70% we will use
| Provider | Limit | What we'll use (70%) | Notes |
|---|---|---|---|
| Binance (crypto) | 6,000 weight/min; fetching every price at once costs 4 | about 4,200/min | One call returns every coin, so the number of coins makes no difference |
| Coinbase (crypto backup) | about 10 calls/sec | only when Binance fails | |
| Yahoo (everything else) | No official limit; about 2,000 calls/hour is a safe working figure | about 1,400/hour, or 23/min | Batches of about 50 symbols per call |
| Twelve Data (backup) | 8 calls/min, 800/day | 5/min, 560/day | Only fills symbols that are missing |

## New timing
- The job still starts once a minute, but inside each run it fetches **4 times, every 15 seconds**.
- Crypto uses about 16 Binance weight/min (well under 1% of the limit), so crypto updates every 15s.
- For Yahoo, the job works out its own speed: calls per pass = symbols ÷ 50. It runs as many passes as fit in 23 calls/min, never more. For example, 400 Yahoo symbols means 8 calls per pass, so 2 passes/min (every 30s). With fewer symbols it goes up to 4 passes.
- A usage counter is kept in the database for each provider. If a provider returns errors or rate-limit replies, the job slows that provider down on its own for 10 minutes.
- Screens check for prices every **15s instead of 30s**, and still pause when the tab is hidden. This roughly doubles database reads, which is still cheap and uses no realtime service.

## More markets (proposed totals: about 550)
- **Crypto: 24 to about 150.** These are the top Binance USDT pairs by trading volume. Matic will be replaced with POL. We could go up to about 400, but small coins are thin, so 150 is the sensible cap.
- **Stocks: 13 to about 250.** This covers the US top 150 (S&P 100 plus popular tech stocks) and about 100 from the UK, Germany and France.
- **Forex: 20 to about 50.** All majors, crosses and common exotics.
- **Indices: 8 to about 20.** For example the DAX, CAC, Nikkei, Hang Seng, ASX, Euro Stoxx and the VIX.
- **Commodities: 6 to about 20.** For example copper, palladium, corn, wheat, soybeans, coffee, sugar, cocoa, cotton and heating oil.
- **Maximum possible:** crypto has no real ceiling, about 400 usable coins. For Yahoo symbols, about 1,150 is the most that still updates once a minute within the 70% budget. Each new market gets 30 days of real chart history filled in automatically.
- Each new market comes with the correct lot size, leverage and market hours for its type.

## Technical details
- `price-feed/index.ts`: loop 4 passes with 15s offsets inside the 60s run. Add per-provider budgets (`BUDGET = limit * 0.7`), with Yahoo passes derived from the symbol count. Write the counters to a new `provider_usage` table (only the backend can read it). Add backoff when a provider returns 429 or errors.
- Raise `BACKFILL_PER_RUN` temporarily so about 480 new markets are filled within about 1 hour.
- Migration to seed the new assets (symbol, api_symbol, category, contract_size, leverage, trading hours).
- `PriceContext.tsx`: change the poll interval from 30s to 15s.
- The price list and asset picker already search and filter. Check that they still work smoothly with about 550 rows.
