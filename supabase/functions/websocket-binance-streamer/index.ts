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
  
  let binanceConnections: WebSocket[] = [];
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
      const binanceSymbols = Object.values(SYMBOL_MAP);
      
      // Build stream list: btcusdt@trade/btcusdt@ticker/ethusdt@trade/...
      const allStreams: string[] = [];
      binanceSymbols.forEach(symbol => {
        allStreams.push(`${symbol}@trade`);
        allStreams.push(`${symbol}@ticker`);
      });
      
      // Split into chunks (24 streams per connection to keep URLs short)
      const STREAMS_PER_CONNECTION = 24;
      const chunks: string[][] = [];
      
      for (let i = 0; i < allStreams.length; i += STREAMS_PER_CONNECTION) {
        chunks.push(allStreams.slice(i, i + STREAMS_PER_CONNECTION));
      }
      
      console.log(`🔌 Creating ${chunks.length} Binance connections with ${allStreams.length} total streams`);
      
      // Create a connection for each chunk using combined stream format
      chunks.forEach((streamChunk, index) => {
        const streamPath = streamChunk.join('/');
        const url = `wss://stream.binance.com:9443/stream?streams=${streamPath}`;
        
        console.log(`📡 Connection ${index + 1}/${chunks.length}: ${streamChunk.length} streams (URL length: ${url.length} chars)`);
        
        const ws = new WebSocket(url);
        
        ws.onopen = () => {
          console.log(`✅ Connected to Binance (${index + 1}/${chunks.length})`);
          reconnectAttempts = 0;
          
          // Send connected message only after first connection
          if (index === 0) {
            socket.send(JSON.stringify({
              type: 'connected',
              message: 'Connected to Binance real-time feed',
              symbols: binanceSymbols.length,
              connections: chunks.length,
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
          }
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Combined stream format: { stream: "btcusdt@trade", data: {...} }
            if (data.stream && data.data) {
              const streamData = data.data;
              
              if (streamData.e === 'trade') {
                // Process trade event
                const trade: BinanceTradeData = streamData;
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
                  
                  // Broadcast to frontend
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
              } else if (streamData.e === '24hrTicker') {
                // Process ticker event
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
            console.error(`❌ Error processing message (connection ${index + 1}):`, error);
          }
        };
        
        ws.onerror = (error) => {
          console.error(`❌ Binance WS error (connection ${index + 1}):`, error);
        };
        
        ws.onclose = () => {
          console.log(`🔌 Binance WS closed (connection ${index + 1}/${chunks.length})`);
          
          // Remove this connection from the array
          binanceConnections = binanceConnections.filter(conn => conn !== ws);
          
          // Reconnect all connections if this was part of a full disconnect
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && socket.readyState === WebSocket.OPEN) {
            reconnectAttempts++;
            const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
            const jitter = Math.random() * 1000; // Add 0-1s jitter
            
            console.log(`🔄 Reconnecting in ${Math.floor(backoffDelay + jitter)}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            
            setTimeout(() => {
              // Close all existing connections before reconnecting
              binanceConnections.forEach(conn => {
                if (conn.readyState === WebSocket.OPEN) {
                  conn.close();
                }
              });
              binanceConnections = [];
              connectToBinance();
            }, backoffDelay + jitter);
          } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error('❌ Max reconnection attempts reached. Please refresh the page.');
          }
        };
        
        binanceConnections.push(ws);
      });
      
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
    
    // Close all Binance connections
    binanceConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    binanceConnections = [];
    
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
