# Price Data Architecture

## Overview
The application uses TWO separate systems to fetch and distribute price data.

---

## 1. REST API System (Fallback)

### Backend: `update-prices` Edge Function
- **Trigger**: Cron job every 3 minutes (scheduled in DB)
- **Data Sources**:
  - **CoinGecko API**: 10 crypto symbols (BTC, ETH, XRP, ADA, DOT, BNB, LINK, LTC, MATIC, SOL)
  - **ExchangeRate API**: 10 forex pairs (EURUSD, GBPUSD, AUDUSD, NZDUSD, USDCAD, USDCHF, USDJPY, EURGBP, EURJPY, GBPJPY)
  - **Simulated**: Commodities, indices, stocks (±1-2% random variation)
- **Process**:
  1. Fetches prices from external APIs
  2. Updates `assets` table in database
  3. Updates P&L for all open trades
  4. Recalculates equity for users with open trades
- **Status**: ✅ WORKING

---

## 2. WebSocket System (Primary)

### Backend: `websocket-price-updates` Edge Function
- **Connection**: AllTick WebSocket API
- **URL Format**: `wss://quote.alltick.io/quote-b-ws-api?token={ALLTICK_API_KEY}`
- **Authentication**: Token in URL parameter (per AllTick docs)
- **Commands**:
  - `cmd_id 22002`: Subscribe to symbols (sent immediately after connection)
  - `cmd_id 22000`: Heartbeat/ping (sent every 10 seconds, required by AllTick)
- **Data Flow**:
  1. Edge function connects to AllTick
  2. Subscribes to ALL 97 symbols in single subscription
  3. Receives real-time tick updates
  4. Broadcasts to all connected frontend clients
  5. Updates database for persistence
- **Status**: ❌ WAS BROKEN (auth issues) - NOW FIXED

### Frontend: Data Distribution
1. **AllTickRestService.ts**
   - Connects to `websocket-price-updates` edge function
   - Receives price broadcasts
   - Distributes to subscribers

2. **PriceContext.tsx**
   - Maintains centralized price Map
   - Provides prices to all components
   - Shows connection status

3. **Components**
   - Trading panels, portfolio, charts all read from PriceContext
   - Real-time updates flow automatically

---

## Why Two Systems?

1. **WebSocket (Primary)**: Real-time updates (sub-second latency)
2. **REST API (Fallback)**: Ensures data freshness even if WebSocket fails

---

## Critical Fix Applied

**Problem**: WebSocket was using wrong authentication method
- ❌ Tried auth-after-connect with cmd_id 22000 (this is for heartbeat!)
- ❌ Used `?t=` parameter (should be `?token=`)

**Solution**: 
- ✅ Token in URL: `?token={ALLTICK_API_KEY}`
- ✅ cmd_id 22002: Subscribe to symbols after connection
- ✅ cmd_id 22000: Heartbeat every 10 seconds (required by AllTick)

**Result**: WebSocket should now connect successfully and stream real-time data for all 97 AllTick-supported symbols.

---

## Monitoring

Check WebSocket status:
- Edge Function Logs: https://supabase.com/dashboard/project/stdfkfutgkmnaajixguz/functions/websocket-price-updates/logs
- Frontend Console: Look for "✅ Connected to AllTick real-time WebSocket feed"
