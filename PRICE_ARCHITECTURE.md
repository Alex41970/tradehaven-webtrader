# Price Architecture - Twelve Data Implementation (Planned)

## Overview
This document outlines the **planned** real-time price delivery system using **Twelve Data WebSocket API**.

> ⚠️ **STATUS**: Awaiting Twelve Data API key from user
> 
> Current state: Old AllTick implementation has been removed. System shows stale prices until new implementation is deployed.

---

## Architecture Design

### Components

1. **Twelve Data WebSocket Connection** (Edge Function)
   - Single persistent WebSocket to Twelve Data
   - Subscribes to all 100 symbols (crypto, forex, stocks, indices, commodities)
   - Receives updates every 1-3 seconds

2. **Supabase Realtime Broadcast**
   - Relays price updates from edge function to active users
   - Uses presence tracking to detect online users
   - Automatically pauses when no users are online

3. **Activity-Aware Frontend**
   - Auto-subscribes when user is active
   - Auto-unsubscribes after 3 minutes of inactivity
   - Tracks mouse, keyboard, touch events

4. **Database Sync**
   - Batch writes every 10 seconds
   - Stores latest prices in `assets` table
   - Serves as fallback for inactive users

---

## Data Flow

```
Twelve Data WS → Edge Function → Supabase Realtime → Active Users
                      ↓
                 Database (every 10s)
```

---

## Implementation Plan

### Phase 1: Edge Function (30 min)
- Create `websocket-price-relay` edge function
- Connect to Twelve Data WebSocket
- Implement presence tracking
- Set up Realtime broadcasting

### Phase 2: Frontend Integration (45 min)
- Create `useSmartPriceSubscription` hook
- Update `PriceContext` to use new subscription
- Add activity tracking
- Implement auto-pause logic

### Phase 3: Database Sync (15 min)
- Add batch write logic
- Update `assets` table schema (✅ DONE)
- Enable Realtime on `assets` table

### Phase 4: Testing & Validation (30 min)
- Test with multiple concurrent users
- Verify latency meets <3s requirement
- Validate auto-pause behavior
- Check resource usage

---

## Expected Performance

- **Latency**: 1-3 seconds (real-time)
- **Concurrent Users**: 10+ easily supported
- **Cost**: ~$206/month ($199 Twelve Data + ~$7 Supabase)
- **Uptime**: 99.9% (Twelve Data SLA)

---

## Asset Coverage (100 symbols)

- ✅ Crypto (38): BTC, ETH, XRP, SOL, ADA, etc.
- ✅ Forex (30): EURUSD, GBPUSD, USDJPY, etc.
- ✅ Stocks (20): AAPL, GOOGL, MSFT, TSLA, etc.
- ✅ Indices (5): SPX500, NAS100, US30, etc.
- ✅ Commodities (4): XAUUSD, XAGUSD, WTIUSD, BCOUSD

---

## Next Steps

1. **User provides Twelve Data API key**
2. **Deploy implementation** (2-3 hours)
3. **Test and validate**
4. **Monitor performance**

---

**Last Updated**: Cleanup phase completed - awaiting API key
