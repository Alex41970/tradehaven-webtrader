import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BinanceTradeData {
  s: string;  // Symbol
  p: string;  // Price
  E: number;  // Event time
}

interface Binance24hrData {
  s: string;  // Symbol
  P: string;  // Price change percent
}

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
}

// Map our crypto symbols to Binance stream format
const SYMBOL_MAP: Record<string, string> = {
  'BTCUSD': 'btcusdt',
  'ETHUSD': 'ethusdt',
  'BNBUSD': 'bnbusdt',
  'XRPUSD': 'xrpusdt',
  'ADAUSD': 'adausdt',
  'SOLUSD': 'solusdt',
  'DOGEUSD': 'dogeusdt',
  'DOTUSD': 'dotusdt',
  'MATICUSD': 'maticusdt',
  'LTCUSD': 'ltcusdt',
  'SHIBUSD': 'shibusdt',
  'AVAXUSD': 'avaxusdt',
  'LINKUSD': 'linkusdt',
  'UNIUSD': 'uniusdt',
  'ATOMUSD': 'atomusdt',
  'TRXUSD': 'trxusdt',
  'NEARUSD': 'nearusdt',
  'ICPUSD': 'icpusdt',
  'APTUSD': 'aptusdt',
  'FILUSD': 'filusdt',
  'ALGOUSD': 'algousdt',
  'GRTUSD': 'grtusdt',
  'SANDUSD': 'sandusdt',
  'MANAUSD': 'manausdt',
  'AAVEUSD': 'aaveusdt',
  'XLMUSD': 'xlmusdt',
  'VETUSD': 'vetusdt',
  'EOSUSD': 'eosusdt',
  'XTZUSD': 'xtzusdt',
  'THETAUSD': 'thetausdt',
  'AXSUSD': 'axsusdt',
  'FTMUSD': 'ftmusdt',
  'KSMUSD': 'ksmusdt',
  'HBARUSD': 'hbarusdt',
  'ZECUSD': 'zecusdt',
  'DASHUSD': 'dashusdt',
  'RUNEUSD': 'runeusdt',
  'ENJUSD': 'enjusdt',
  'BATUSD': 'batusdt',
  'YFIUSD': 'yfiusdt',
  'ZENUSDT': 'zenusdt',
  'ILVUSD': 'ilvusdt',
  'IMXUSD': 'imxusdt'
};

// Reverse map for Binance -> Our symbols
const REVERSE_SYMBOL_MAP: Record<string, string> = Object.entries(SYMBOL_MAP).reduce((acc, [key, value]) => {
  acc[value.toUpperCase()] = key;
  return acc;
}, {} as Record<string, string>);

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let binanceWs: WebSocket | null = null;
  let pingInterval: number | null = null;
  let dbUpdateInterval: number | null = null;
  const priceCache = new Map<string, PriceUpdate>();
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  
  console.log('✅ Frontend client connected');

  socket.onopen = () => {
    connectToBinance();
  };

  function connectToBinance() {
    try {
      // Use simple WebSocket URL, then SUBSCRIBE after connection
      const binanceUrl = 'wss://stream.binance.com:9443/ws';
      console.log('🔌 Connecting to Binance WebSocket...');
      
      binanceWs = new WebSocket(binanceUrl);
      
      binanceWs.onopen = () => {
        console.log('✅ Connected to Binance WebSocket (real-time crypto)');
        reconnectAttempts = 0;
        
        // Build subscription list from our symbol map
        const binanceSymbols = Object.values(SYMBOL_MAP);
        const streams: string[] = [];
        
        // Add both trade and ticker streams for each symbol
        binanceSymbols.forEach(symbol => {
          streams.push(`${symbol}@trade`);
          streams.push(`${symbol}@ticker`);
        });
        
        console.log(`📡 Subscribing to ${streams.length} streams (${binanceSymbols.length} symbols)...`);
        
        // Subscribe in batches of 40 streams to avoid overwhelming Binance
        const BATCH_SIZE = 40;
        for (let i = 0; i < streams.length; i += BATCH_SIZE) {
          const batch = streams.slice(i, i + BATCH_SIZE);
          const subscribeMessage = {
            method: 'SUBSCRIBE',
            params: batch,
            id: Math.floor(Date.now() / 1000) + i
          };
          
          binanceWs!.send(JSON.stringify(subscribeMessage));
          console.log(`📥 Sent subscription batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(streams.length / BATCH_SIZE)} (${batch.length} streams)`);
        }
        
        // Send welcome message to frontend
        socket.send(JSON.stringify({
          type: 'connected',
          message: 'Connected to Binance real-time feed',
          symbols: binanceSymbols.length,
          timestamp: Date.now()
        }));

        // Start ping interval (keep connection alive)
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        }, 30000);

        // Start database update interval (every 10 seconds)
        if (dbUpdateInterval) clearInterval(dbUpdateInterval);
        dbUpdateInterval = setInterval(async () => {
          await updateDatabase();
        }, 10000);
      };

      binanceWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle subscription confirmation
          if (data.result === null && data.id) {
            console.log(`✅ Subscription confirmed (ID: ${data.id})`);
            return;
          }
          
          // Handle subscription errors
          if (data.error) {
            console.error('❌ Binance subscription error:', data.error);
            return;
          }
          
          // Process price updates
          if (data.e === 'trade') {
            // Real-time trade update
            const trade: BinanceTradeData = data;
            const binanceSymbol = trade.s;
            const ourSymbol = REVERSE_SYMBOL_MAP[binanceSymbol];
            
            if (ourSymbol) {
              const price = parseFloat(trade.p);
              const existing = priceCache.get(ourSymbol);
              
              priceCache.set(ourSymbol, {
                symbol: ourSymbol,
                price: price,
                change_24h: existing?.change_24h || 0,
                timestamp: trade.E
              });

              // Broadcast immediately to frontend
              socket.send(JSON.stringify({
                type: 'price_update',
                prices: [{
                  symbol: ourSymbol,
                  price: price,
                  change_24h: existing?.change_24h || 0,
                  timestamp: trade.E
                }],
                source: 'Binance'
              }));
            }
          } else if (data.e === '24hrTicker') {
            // 24hr ticker update (includes change %)
            const ticker: Binance24hrData = data;
            const binanceSymbol = ticker.s;
            const ourSymbol = REVERSE_SYMBOL_MAP[binanceSymbol];
            
            if (ourSymbol) {
              const changePercent = parseFloat(ticker.P);
              const existing = priceCache.get(ourSymbol);
              
              if (existing) {
                existing.change_24h = changePercent;
                priceCache.set(ourSymbol, existing);
              }
            }
          }
        } catch (error) {
          console.error('Error processing Binance message:', error);
        }
      };

      binanceWs.onerror = (error) => {
        console.error('❌ Binance WebSocket error:', error);
      };

      binanceWs.onclose = () => {
        console.log('🔌 Binance WebSocket closed');
        
        // Attempt to reconnect with backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && socket.readyState === WebSocket.OPEN) {
          reconnectAttempts++;
          const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
          console.log(`🔄 Reconnecting to Binance in ${backoffDelay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          
          setTimeout(() => {
            connectToBinance();
          }, backoffDelay);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.error('❌ Max reconnection attempts reached. Please refresh the page.');
        }
      };

    } catch (error) {
      console.error('❌ Failed to connect to Binance:', error);
    }
  }

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      // Handle ping from client
      if (message.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (error) {
      console.error('Error handling client message:', error);
    }
  };

  socket.onclose = () => {
    console.log('🔌 Client disconnected');
    
    // Cleanup
    if (binanceWs) {
      binanceWs.close();
    }
    if (pingInterval) {
      clearInterval(pingInterval);
    }
    if (dbUpdateInterval) {
      clearInterval(dbUpdateInterval);
    }
  };

  // Function to batch update database
  async function updateDatabase() {
    if (priceCache.size === 0) return;

    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const updates = Array.from(priceCache.values());
      
      // Batch update all prices
      for (const update of updates) {
        await supabase
          .from('assets')
          .update({
            price: update.price,
            change_24h: update.change_24h,
            price_updated_at: new Date(update.timestamp).toISOString()
          })
          .eq('symbol', update.symbol);
      }

      console.log(`📊 Updated ${updates.length} crypto prices in database`);

      // Update P&L for open trades
      const { data: openTrades } = await supabase
        .from('trades')
        .select('*, assets(symbol, contract_size)')
        .eq('status', 'open');

      if (openTrades && openTrades.length > 0) {
        for (const trade of openTrades) {
          const priceData = priceCache.get(trade.assets.symbol);
          if (priceData) {
            const priceDiff = trade.trade_type === 'BUY'
              ? (priceData.price - trade.open_price)
              : (trade.open_price - priceData.price);
            
            const pnl = trade.amount * priceDiff * (trade.leverage || 1);

            await supabase
              .from('trades')
              .update({
                current_price: priceData.price,
                pnl: parseFloat(pnl.toFixed(2))
              })
              .eq('id', trade.id);
          }
        }
        console.log(`💰 Updated P&L for ${openTrades.length} open trades`);
      }

    } catch (error) {
      console.error('Error updating database:', error);
    }
  }

  return response;
});
