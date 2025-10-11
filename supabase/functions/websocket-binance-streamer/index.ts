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
    console.log('🔌 Client connected - starting REST polling (WebSocket blocked)');
    startRestPolling();
  };
  
  // REST API polling as primary method (WebSocket connections are blocked)
  function startRestPolling() {
    // Send connected message
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to Binance REST API feed',
      method: 'polling',
      interval: '2s',
      timestamp: Date.now()
    }));
    
    // Initial fetch
    fetchAllPrices();
    
    // Start intervals
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 30000);
    
    // Fetch prices every 2 seconds
    if (dbUpdateInterval) clearInterval(dbUpdateInterval);
    dbUpdateInterval = setInterval(async () => {
      await fetchAllPrices();
    }, 2000);
  }
  
  async function fetchAllPrices() {
    try {
      const binanceSymbols = Object.values(SYMBOL_MAP);
      
      // Fetch all ticker prices in one call
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      
      if (!response.ok) {
        console.error(`❌ Binance API error: ${response.status}`);
        return;
      }
      
      const allTickers = await response.json();
      let updateCount = 0;
      
      // Process only our symbols
      for (const ticker of allTickers) {
        const binanceSymbol = ticker.symbol.toLowerCase();
        const ourSymbol = REVERSE_SYMBOL_MAP[ticker.symbol];
        
        if (ourSymbol && binanceSymbols.includes(binanceSymbol)) {
          const price = parseFloat(ticker.lastPrice);
          const change = parseFloat(ticker.priceChangePercent);
          
          priceCache.set(ourSymbol, {
            symbol: ourSymbol,
            price: price,
            change_24h: change,
            timestamp: Date.now()
          });
          
          updateCount++;
        }
      }
      
      // Broadcast all prices to frontend
      if (priceCache.size > 0) {
        const prices = Array.from(priceCache.values());
        socket.send(JSON.stringify({
          type: 'price_update',
          prices: prices,
          source: 'Binance REST',
          count: updateCount
        }));
        
        console.log(`📊 Updated ${updateCount} prices via REST API`);
      }
      
      // Update database every 5 fetches (~10 seconds)
      if (Math.random() < 0.2) { // 20% chance = ~every 10s
        await updateDatabase();
      }
      
    } catch (error) {
      console.error('❌ Error fetching prices:', error);
    }
  }

  // WebSocket method removed - using REST polling instead due to connection blocks

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
