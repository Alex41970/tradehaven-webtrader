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

// Reconnection state with exponential backoff
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 60000; // 60 seconds
let circuitBreakerTripped = false;
let lastTickReceived = 0;

// Sanitize and normalize AllTick API key from secrets
function sanitizeAllTickKey(key: string | null): string | null {
  if (!key) return null;
  let k = key.trim().replace(/^['"]|['"]$/g, '');
  // Remove all whitespace just in case and optional suffixes vendors append
  k = k.replace(/\s+/g, '').replace(/-c-app$/i, '');
  if (!/^[A-Za-z0-9]+$/.test(k)) {
    console.warn('⚠️ ALLTICK_API_KEY contains unexpected characters; using sanitized value.');
  }
  const masked = k.length > 8 ? `${k.slice(0,4)}...${k.slice(-4)}` : k;
  console.log(`🔑 Using sanitized AllTick key: ${masked}`);
  return k;
}

/**
 * Connect to AllTick WebSocket API
 * Token MUST be in URL per AllTick documentation
 * Single connection for all 100 symbols
 */
async function connectToAllTick() {
  // Check circuit breaker
  if (circuitBreakerTripped) {
    console.error('🚫 Circuit breaker tripped - not attempting reconnection');
    return;
  }
  
  const rawKey = Deno.env.get('ALLTICK_API_KEY');
  const apiKey = sanitizeAllTickKey(rawKey);
  if (!apiKey) {
    console.error('❌ ALLTICK_API_KEY not configured or invalid in Supabase secrets');
    return;
  }
  
  // CRITICAL: AllTick requires token with ?token= parameter (per official examples)
  // Reference: AllTick GitHub examples (Go, Java, PHP, Python all use ?token=)
  const wsUrl = `wss://quote.alltick.io/quote-b-ws-api?token=${apiKey}`;
  console.log(`🔌 Connecting to AllTick WebSocket (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
  
  allTickWS = new WebSocket(wsUrl);
  
  allTickWS.onopen = () => {
    console.log('✅ Connected to AllTick WebSocket');
    // Reset reconnection state on successful connection
    reconnectAttempts = 0;
    circuitBreakerTripped = false;
    // After connection, subscribe to symbols immediately
    subscribeToAllSymbols();
    // Start heartbeat
    startHeartbeat();
  };
  
  allTickWS.onmessage = (event) => {
    handleAllTickMessage(event.data);
  };
  
  allTickWS.onerror = (error) => {
    console.error('❌ AllTick WebSocket error:', error);
    
    // Check if this is a 400 Bad Request (authentication issue)
    const errorMessage = error instanceof ErrorEvent ? error.message : String(error);
    if (errorMessage.includes('400 Bad Request')) {
      console.error('🚫 Authentication failed (400 Bad Request) - check API key format');
      console.error('   Expected format: ?token=<api_key> in WebSocket URL');
      circuitBreakerTripped = true;
    }
  };
  
  allTickWS.onclose = (event) => {
    console.log(`🔌 AllTick WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
    isSubscribed = false;
    stopHeartbeat();
    allTickWS = null;
    
    // Don't reconnect if circuit breaker is tripped
    if (circuitBreakerTripped) {
      console.error('🚫 Not reconnecting due to circuit breaker');
      return;
    }
    
    // Check if we've exceeded max reconnect attempts
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`🚫 Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached - stopping reconnection`);
      circuitBreakerTripped = true;
      return;
    }
    
    // Calculate exponential backoff with jitter
    const exponentialDelay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_DELAY
    );
    const jitter = Math.random() * 1000; // 0-1s random jitter
    const delay = exponentialDelay + jitter;
    
    reconnectAttempts++;
    console.log(`🔄 Reconnecting in ${(delay / 1000).toFixed(1)}s...`);
    reconnectTimeout = setTimeout(connectToAllTick, delay);
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
      symbol_list: allSymbols.map(code => ({ code, depth_level: 5 }))
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
    
    // Heartbeat response (cmd_id 22000 is for heartbeat, NOT auth)
    if (message.cmd_id === 22000) {
      console.log('💓 Heartbeat acknowledged');
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
        // Update last tick received timestamp
        lastTickReceived = Date.now();
        
        // Log tick reception (first few for debugging)
        const timeSinceLastTick = lastTickReceived > 0 ? Date.now() - lastTickReceived : 0;
        if (prices.length <= 3 || Math.random() < 0.1) { // Log occasionally to avoid spam
          console.log(`📊 Received ${prices.length} price updates (${timeSinceLastTick}ms since last)`);
        }
        
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
        cmd_id: 22000, // Heartbeat/Ping (per AllTick docs)
        seq_id: Date.now(),
        trace: crypto.randomUUID()
      }));
    }
  }, 10000); // Every 10 seconds (per AllTick docs requirement)
  
  console.log('💓 Started heartbeat (10s intervals per AllTick requirement)');
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
      // Note: startHeartbeat() is called inside connectToAllTick after connection
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
