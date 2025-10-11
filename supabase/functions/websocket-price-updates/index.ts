import { getAllTickSymbols } from '../_shared/allTickSymbolMapping.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
}

// Store all connected WebSocket clients
const connectedClients = new Set<WebSocket>();

// Central price polling state
let pollingInterval: number | null = null;
let isPolling = false;
let lastPrices: PriceUpdate[] = [];

/**
 * Central AllTick price poller - runs once every 3 seconds
 * Broadcasts to all connected WebSocket clients
 */
async function startCentralPoller() {
  if (isPolling) return;
  
  isPolling = true;
  console.log('🚀 Starting central AllTick price poller (3s intervals, staggered requests)');
  console.log('📊 Rate limiting: 2 requests per 3s poll (1.5s apart) = 40 req/min (limit: 60)');
  console.log('⏱️  Request timing: Batch 1 at 0s, Batch 2 at 1.5s, Next poll at 3s');
  
  // Initial fetch
  await fetchAndBroadcastPrices();
  
  // Poll every 3 seconds
  pollingInterval = setInterval(async () => {
    await fetchAndBroadcastPrices();
  }, 3000);
}

function stopCentralPoller() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  isPolling = false;
  console.log('⏸️ Central price poller stopped (no clients connected)');
}

async function updateDatabasePrices(prices: PriceUpdate[]) {
  if (prices.length === 0) return;
  
  try {
    // Update each symbol individually to avoid NULL constraint violations
    let successCount = 0;
    let failCount = 0;
    
    for (const p of prices) {
      const timestampISO = new Date(p.timestamp).toISOString();
      
      // Log first few updates for debugging
      if (successCount < 3) {
        console.log(`📝 Updating ${p.symbol}: price=${p.price}, timestamp=${timestampISO}`);
      }
      
      const { data, error } = await supabase
        .from('assets')
        .update({
          price: p.price,
          price_updated_at: timestampISO
        })
        .eq('symbol', p.symbol)
        .select('symbol, price, price_updated_at, updated_at');
      
      if (error) {
        console.error(`❌ Failed to update ${p.symbol}:`, error);
        failCount++;
      } else if (data && data.length > 0) {
        if (successCount < 3) {
          console.log(`✅ Updated ${p.symbol} - DB shows: price_updated_at=${data[0].price_updated_at}, updated_at=${data[0].updated_at}`);
        }
        successCount++;
      } else {
        console.warn(`⚠️ No rows updated for symbol: ${p.symbol} (may not exist in DB)`);
        failCount++;
      }
    }
    
    if (failCount > 0) {
      console.log(`⚠️ Database update: ${successCount} succeeded, ${failCount} failed (likely missing assets)`);
    } else {
      console.log(`💾 Updated ${successCount} prices in database`);
    }
  } catch (error) {
    console.error('❌ Error updating database:', error);
  }
}

async function fetchAndBroadcastPrices() {
  try {
    const apiKey = Deno.env.get('ALLTICK_API_KEY');
    if (!apiKey) {
      console.error('❌ ALLTICK_API_KEY not configured');
      return;
    }

    const allTickSymbols = getAllTickSymbols();
    
    // Split by API endpoint
    const forexCryptoCommoditySymbols = allTickSymbols.filter(code => !/(\.US|\.IDX)$/.test(code));
    const stockIndexSymbols = allTickSymbols.filter(code => /(\.US|\.IDX)$/.test(code));

    const prices: PriceUpdate[] = [];

    // Batch 1: Forex/Crypto/Commodities (quote-b-api)
    if (forexCryptoCommoditySymbols.length > 0) {
      const batch1 = await makeRequest('https://quote.alltick.io/quote-b-api', forexCryptoCommoditySymbols, apiKey);
      prices.push(...batch1);
      
      // Wait 1.5 seconds before second batch to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Batch 2: Stocks/Indices (quote-stock-b-api)
    if (stockIndexSymbols.length > 0) {
      const batch2 = await makeRequest('https://quote.alltick.io/quote-stock-b-api', stockIndexSymbols, apiKey);
      prices.push(...batch2);
    }

    lastPrices = prices;

    // Broadcast to all connected clients
    const message = JSON.stringify({
      type: 'price_update',
      prices,
      timestamp: Date.now(),
      stats: {
        requested: allTickSymbols.length,
        received: prices.length,
        successRate: ((prices.length / allTickSymbols.length) * 100).toFixed(1) + '%'
      }
    });

    let disconnectedClients = 0;
    connectedClients.forEach(client => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        } else {
          connectedClients.delete(client);
          disconnectedClients++;
        }
      } catch (error) {
        console.error('Error sending to client:', error);
        connectedClients.delete(client);
        disconnectedClients++;
      }
    });

    console.log(`✅ Broadcasted ${prices.length}/${allTickSymbols.length} prices to ${connectedClients.size} clients`);
    
    if (disconnectedClients > 0) {
      console.log(`🧹 Cleaned up ${disconnectedClients} disconnected clients`);
    }

    // Update database with fresh prices
    await updateDatabasePrices(prices);

  } catch (error) {
    console.error('❌ Error in central poller:', error);
  }
}

async function makeRequest(baseUrl: string, symbols: string[], apiKey: string): Promise<PriceUpdate[]> {
  if (symbols.length === 0) return [];
  
  const query = encodeURIComponent(JSON.stringify({
    trace: `websocket_batch_${Date.now()}`,
    data: { symbol_list: symbols.map(code => ({ code })) }
  }));
  
  const url = `${baseUrl}/trade-tick?token=${apiKey}&query=${query}`;
  const response = await fetch(url);

  if (!response.ok) {
    console.error(`❌ Request failed: ${response.status} ${response.statusText}`);
    console.error(`   Requested symbols (${symbols.length}):`, symbols.join(', '));
    return [];
  }

  const json: any = await response.json();
  
  if (json.ret === 600) {
    console.warn(`⚠️ Symbols not available (ret:600): ${json.msg}`);
    console.warn(`   Requested symbols (${symbols.length}):`, symbols.join(', '));
    return [];
  }
  
  if (json.ret !== 200 && json.code !== 0) {
    console.error(`❌ API Error: ret=${json.ret}, msg=${json.msg}`);
    console.error(`   Requested symbols (${symbols.length}):`, symbols.join(', '));
    return [];
  }
  
  const tickList = json?.data?.tick_list || [];
  const updates: PriceUpdate[] = [];
  const receivedSymbols = new Set<string>();
  
  for (const tick of tickList) {
    const price = parseFloat(tick.price);
    if (!isNaN(price)) {
      receivedSymbols.add(tick.code);
      updates.push({
        symbol: tick.code,
        price,
        change_24h: 0,
        timestamp: Number(tick.tick_time) || Date.now()
      });
    }
  }
  
  // Log missing symbols
  const missingSymbols = symbols.filter(s => !receivedSymbols.has(s));
  if (missingSymbols.length > 0) {
    console.warn(`⚠️ Missing ${missingSymbols.length} symbols from response:`);
    console.warn(`   ${missingSymbols.join(', ')}`);
  }
  
  return updates;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Upgrade to WebSocket
  const upgrade = req.headers.get('upgrade') || '';
  if (upgrade.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket connection', { 
      status: 426,
      headers: corsHeaders 
    });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => {
    connectedClients.add(socket);
    console.log(`🔌 Client connected (total: ${connectedClients.size})`);
    
    // Start central poller if this is the first client
    if (connectedClients.size === 1) {
      startCentralPoller();
    }
    
    // Send last known prices immediately
    if (lastPrices.length > 0) {
      socket.send(JSON.stringify({
        type: 'price_update',
        prices: lastPrices,
        timestamp: Date.now(),
        cached: true
      }));
    }
    
    // Send connection confirmation
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to AllTick price feed',
      clientCount: connectedClients.size
    }));
  };

  socket.onclose = () => {
    connectedClients.delete(socket);
    console.log(`🔌 Client disconnected (remaining: ${connectedClients.size})`);
    
    // Stop central poller if no clients left
    if (connectedClients.size === 0) {
      stopCentralPoller();
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    connectedClients.delete(socket);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  return response;
});
