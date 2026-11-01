# Market intelligence and engagement features

Five additions, built in this order. All use our own database and current prices, so they add no calls to price providers and no live-connection costs.

## 1. Community sentiment bar (trading screen)
- A bar under the order ticket: "82% of traders are buying BTC/USD", with a buyer/seller split shown in green and red.
- Worked out from open positions on the platform. It never shows who holds them, only totals.
- If fewer than 5 traders hold a market, it shows "Not enough data yet" so the numbers aren't misleading.
- Refreshes every 5 minutes.

## 2. Price alerts with a chime
- A bell button on the chart and in the order ticket: "Alert me when Gold goes above or below $X".
- When the price crosses, you hear a short chime and see a pop-up message. Alerts are saved to your account, and a "My alerts" list lets you manage them.
- Alerts are checked in the browser against the prices it already loads, so they fire only while the app is open. Alerts that fire while you're away aren't part of this version.
- A switch in the alerts list turns the sound on or off.

## 3. Market heatmap and screener (new "Markets" page in the left menu)
- Heatmap: a grid of tiles, one per market, coloured green or red by the 24h change and grouped by Crypto, Stocks, Forex, Indices and Commodities.
- Screener: a table you can sort by 24h change, price and category, with filters for top gainers and top losers. Clicking a market opens it on the trading screen.
- Note: our price feeds don't give reliable trading volume, so volume isn't shown. Tiles are all the same size and ranked by how much they moved.

## 4. Trading journal (new "Journal" page in the left menu)
- Uses your closed trades: profit factor, win rate, win/loss ratio, average win and loss, average hold time, best and worst market, and best asset class.
- Charts: profit and loss by day of the week, by hour, and by asset class, plus a list of your best and worst trades.
- A date filter: 7 days, 30 days, 90 days or all time.

## 5. Custom watchlists
- Create, rename and delete your own lists (for example "Morning Watchlist"). A star menu on any market adds it to one or more lists.
- Your lists appear as tabs in the trading screen's market list, next to the asset-class tabs. Your existing favourites become a default "Favorites" list.

## Technical details
- Sentiment: a SECURITY DEFINER function `get_market_sentiment(_symbol)` returns only the buy and sell counts and lots from open `trades` (minimum 5 traders), callable by authenticated users.
- New tables, each with GRANTs, RLS limited to `auth.uid()`, and `user_id uuid` with no foreign key to auth:
  - `price_alerts` (symbol, direction above/below, target_price, is_active, triggered_at)
  - `watchlists` (name, sort_order)
  - `watchlist_items` (watchlist_id, asset_id, unique pair)
- Existing `user_favorites` rows are copied into a "Favorites" watchlist for each user.
- Alerts hook: compares the server price from `assets`, not the simulated price, against the previous value to detect crossings. The chime is generated with Web Audio, so no sound file is needed. Each alert fires once and is then marked as triggered.
- New views: "markets" and "journal" are added to the Dashboard `View` union, rendered inside AppShell using the bento widgets and Recharts with theme tokens only.
- The journal is computed in the client from `useTrades` closed trades.
- Tests: unit tests for the journal math (profit factor, win rate, hold time) and for alert crossing detection.
