# Trading bot and sample bot trades for both demo accounts

## What you'll get
- **Trading bot turned on** for user1@demo.com and user2@demo.com. Each account gets its own licence key, issued by manager 2@2.com. Both accounts are also linked to 2@2.com, so they show up on that manager's admin page.
- **Bot trade history on each account:** about 8–10 closed bot trades over the last 7 days, covering BTC, ETH, EUR/USD, gold and Apple. They are a mix of wins and losses, with an overall small profit (roughly +$1,500 to +$3,000).
- **2 open bot positions on each account**, so the bot dashboard shows open positions with live P&L.
- Balances will go up or down by the profit or loss on the closed trades. The money set aside for the open trades will be held as margin.

## How it's done
1. Create the two licences and connect each one to its account, with the same bot permissions as 1@1.com.
2. Add the closed trades marked as bot trades, using realistic prices from the stored price history for each date. The balance changes by each trade's real profit or loss.
3. Open the 2 positions through the normal trade-opening process, so the open price and margin come from the live price.
4. Sign in to both accounts and check that the bot screen shows the chart, the activity list and the open positions.

## Technical details
- Licences go in `bot_licenses` (admin_id = 2@2.com, used_by = user), with `user_bot_status` set to active, plus `user_profiles.admin_id` and `admin_user_relationships`.
- Closed trades: `trades` rows with trade_source='bot', status='closed', opened_at/closed_at in the past, and pnl from `calc_trade_pnl` with contract sizes from `assets`. The balance is adjusted through the existing settlement path, either the close trigger or `admin_modify_user_balance`, so the totals stay consistent.
- Open trades are inserted with trade_source='bot'; the insert trigger sets the open price and margin. After that, `recalculate_user_margins` runs for each user.
