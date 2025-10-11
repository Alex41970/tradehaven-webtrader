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
  
  console.log('🔌 Client connected to Binance streamer');

  // Build Binance combined stream URL for all crypto symbols
  const binanceSymbols = Object.values(SYMBOL_MAP);
  const tradeStreams = binanceSymbols.map(s => `${s}@trade`).join('/');
  const tickerStreams = binanceSymbols.map(s => `${s}@ticker`).join('/');
  const binanceUrl = `wss://stream.binance.com:9443/stream?streams=${tradeStreams}/${tickerStreams}`;

  socket.onopen = () => {
    console.log('✅ Frontend client connected');
    
    // Connect to Binance WebSocket
    try {
      binanceWs = new WebSocket(binanceUrl);
      
      binanceWs.onopen = () => {
        console.log(`🚀 Connected to Binance (${binanceSymbols.length} symbols)`);
        
        // Send welcome message
        socket.send(JSON.stringify({
          type: 'connected',
          message: 'Connected to Binance real-time feed',
          symbols: binanceSymbols.length,
          timestamp: Date.now()
        }));

        // Start ping interval (keep connection alive)
        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        }, 30000);

        // Start database update interval (every 10 seconds)
        dbUpdateInterval = setInterval(async () => {
          await updateDatabase();
        }, 10000);
      };

      binanceWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Binance sends data wrapped in {stream, data}
          if (data.stream && data.data) {
            const streamData = data.data;
            const streamName = data.stream as string;
            
            if (streamName.includes('@trade')) {
              // Real-time trade update
              const trade: BinanceTradeData = streamData;
              const binanceSymbol = trade.s;
              const ourSymbol = REVERSE_SYMBOL_MAP[binanceSymbol];
              
              if (ourSymbol) {
                const price = parseFloat(trade.p);
                const existing = priceCache.get(ourSymbol);
                
                priceCache.set(ourSymbol, {
                  symbol: ourSymbol,
                  price: price,
                  change_24h: existing?.change_24h || 0, // Keep existing change until ticker update
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
            } else if (streamName.includes('@ticker')) {
              // 24hr ticker update (includes change %)
              const ticker: Binance24hrData = streamData;
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
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (socket.readyState === WebSocket.OPEN) {
            console.log('🔄 Reconnecting to Binance...');
            socket.onopen?.(new Event('open'));
          }
        }, 5000);
      };

    } catch (error) {
      console.error('Failed to connect to Binance:', error);
    }
  };

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
            // Crypto P&L calculation (simplified, no contract_size needed for crypto)
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
