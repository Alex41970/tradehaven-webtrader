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

// Store all connected frontend WebSocket clients
const connectedClients = new Set<WebSocket>();

// AllTick WebSocket connection state
let allTickWS: WebSocket | null = null;
let isSubscribed = false;
let reconnectTimeout: number | null = null;
let heartbeatInterval: number | null = null;
let lastPrices: PriceUpdate[] = [];

/**
 * Connect to AllTick WebSocket API using auth-after-connect
 * Single connection for all 100 symbols
 */
async function connectToAllTick() {
  const apiKey = Deno.env.get('ALLTICK_API_KEY');
  if (!apiKey) {
    console.error('❌ ALLTICK_API_KEY not configured in Supabase secrets');
    return;
  }
  
  // Connect WITHOUT token in URL - we'll authenticate after connection
  const wsUrl = 'wss://quote.alltick.io/quote-b-ws-api';
  console.log('🔌 Connecting to AllTick WebSocket (auth-after-connect method)...');
  
  allTickWS = new WebSocket(wsUrl);
  
  allTickWS.onopen = () => {
    console.log('✅ Connected to AllTick WebSocket, sending authentication...');
    
    // Authenticate AFTER connection is established
    const authMessage = {
      cmd_id: 22000, // Authentication command
      seq_id: Date.now(),
      trace: crypto.randomUUID(),
      data: {
        token: apiKey
      }
    };
    
    allTickWS!.send(JSON.stringify(authMessage));
    console.log('🔑 Authentication message sent');
  };
  
  allTickWS.onmessage = (event) => {
    handleAllTickMessage(event.data);
  };
  
  allTickWS.onerror = (error) => {
    console.error('❌ AllTick WebSocket error:', error);
  };
  
  allTickWS.onclose = () => {
    console.log('🔌 AllTick WebSocket closed, reconnecting in 5s...');
    isSubscribed = false;
    allTickWS = null;
    reconnectTimeout = setTimeout(connectToAllTick, 5000);
  };
}

/**
 * Subscribe to ALL 100 symbols in a single subscription
 * CRITICAL: AllTick only allows 1 subscription at a time, so we must send all symbols together
 */
function subscribeToAllSymbols() {
  if (!allTickWS || isSubscribed) return;
  
  const allSymbols = getAllTickSymbols(); // All 100 symbols
  
  const subscribeMessage = {
    cmd_id: 22002, // Real-time tick data subscription
    seq_id: Date.now(),
    trace: crypto.randomUUID(),
    data: {
      symbol_list: allSymbols.map(code => ({ code }))
    }
  };
  
  allTickWS.send(JSON.stringify(subscribeMessage));
  isSubscribed = true;
  console.log(`📡 Subscribed to ALL ${allSymbols.length} symbols in single subscription`);
  console.log(`   Symbols: ${allSymbols.slice(0, 10).join(', ')}... (showing first 10)`);
}

/**
 * Handle incoming messages from AllTick WebSocket
 */
function handleAllTickMessage(data: string) {
  try {
    const message = JSON.parse(data);
    
    // Authentication response
    if (message.cmd_id === 22000) {
      if (message.data?.code === 0) {
        console.log('✅ Authentication successful! Now subscribing to symbols...');
        subscribeToAllSymbols();
      } else {
        console.error('❌ Authentication failed:', message.data);
      }
      return;
    }
    
    // Subscription confirmation
    if (message.cmd_id === 22002 && message.data?.code === 0) {
      console.log('✅ Subscription confirmed by AllTick');
      return;
    }
    
    // Price updates
    if (message.data?.tick_list || message.data?.tick) {
      const tickList = message.data.tick_list || message.data.tick || [];
      const prices: PriceUpdate[] = [];
      
      for (const tick of tickList) {
        const price = parseFloat(tick.price || tick.last);
        if (!isNaN(price)) {
          prices.push({
            symbol: tick.code,
            price,
            change_24h: parseFloat(tick.change_rate || 0),
            timestamp: Date.now() // Use server time for freshness
          });
        }
      }
      
      if (prices.length > 0) {
        // Update cache - merge new prices with existing ones
        const updatedSymbols = new Set(prices.map(p => p.symbol));
        lastPrices = [
          ...lastPrices.filter(p => !updatedSymbols.has(p.symbol)),
          ...prices
        ];
        
        // Broadcast to all connected frontend clients
        broadcastPrices(prices);
        
        // Update database
        updateDatabasePrices(prices);
      }
    }
    
    // Heartbeat/ping response (same cmd_id as auth but comes later)
    if (message.cmd_id === 22001) {
      console.log('💓 Heartbeat acknowledged by AllTick');
    }
    
  } catch (error) {
    console.error('❌ Error parsing AllTick message:', error);
  }
}

/**
 * Broadcast price updates to all connected frontend clients
 */
function broadcastPrices(prices: PriceUpdate[]) {
  const message = JSON.stringify({
    type: 'price_update',
    prices,
    timestamp: Date.now(),
    stats: {
      received: prices.length,
      total_symbols: getAllTickSymbols().length,
      cached_total: lastPrices.length,
      successRate: `${((lastPrices.length / getAllTickSymbols().length) * 100).toFixed(1)}%`
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
      console.error('Error broadcasting to client:', error);
      connectedClients.delete(client);
      disconnectedClients++;
    }
  });
  
  if (disconnectedClients > 0) {
    console.log(`🧹 Cleaned up ${disconnectedClients} disconnected clients`);
  }
}

/**
 * Start heartbeat/keepalive with AllTick
 * Send ping every 30 seconds
 */
function startHeartbeat() {
  if (heartbeatInterval) return;
  
  heartbeatInterval = setInterval(() => {
    if (allTickWS?.readyState === WebSocket.OPEN) {
      allTickWS.send(JSON.stringify({
        cmd_id: 22001, // Ping/Heartbeat (different from auth cmd_id)
        seq_id: Date.now(),
        trace: crypto.randomUUID()
      }));
    }
  }, 30000); // Every 30 seconds
  
  console.log('💓 Started heartbeat (30s intervals)');
}

/**
 * Stop heartbeat
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('💔 Stopped heartbeat');
  }
}

/**
 * Update database with fresh prices
 */
async function updateDatabasePrices(prices: PriceUpdate[]) {
  if (prices.length === 0) return;
  
  try {
    let successCount = 0;
    let failCount = 0;
    
    for (const p of prices) {
      // Use current server time
      const timestampISO = new Date().toISOString();
      
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
        .select('symbol, price, price_updated_at');
      
      if (error) {
        console.error(`❌ Failed to update ${p.symbol}:`, error);
        failCount++;
      } else if (data && data.length > 0) {
        if (successCount < 3) {
          console.log(`✅ Updated ${p.symbol} - DB shows: price_updated_at=${data[0].price_updated_at}`);
        }
        successCount++;
      } else {
        console.warn(`⚠️ No rows updated for symbol: ${p.symbol} (may not exist in DB)`);
        failCount++;
      }
    }
    
    if (failCount > 0) {
      console.log(`⚠️ Database update: ${successCount} succeeded, ${failCount} failed`);
    } else {
      console.log(`💾 Updated ${successCount} prices in database`);
    }
  } catch (error) {
    console.error('❌ Error updating database:', error);
  }
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
    
    // Start AllTick WebSocket when first client connects
    if (connectedClients.size === 1 && !allTickWS) {
      connectToAllTick();
      startHeartbeat();
    }
    
    // Send cached prices immediately
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
      message: 'Connected to AllTick real-time WebSocket feed',
      clientCount: connectedClients.size
    }));
  };

  socket.onclose = () => {
    connectedClients.delete(socket);
    console.log(`🔌 Client disconnected (remaining: ${connectedClients.size})`);
    
    // Close AllTick connection when last client disconnects
    if (connectedClients.size === 0 && allTickWS) {
      allTickWS.close();
      allTickWS = null;
      isSubscribed = false;
      stopHeartbeat();
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    connectedClients.delete(socket);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Handle ping from frontend clients
      if (data.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  return response;
});
