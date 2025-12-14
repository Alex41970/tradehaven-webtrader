import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Symbol mappings: Internal symbol -> CoinGecko ID
const COINGECKO_SYMBOLS: Record<string, string> = {
  'BTCUSD': 'bitcoin', 'ETHUSD': 'ethereum', 'BNBUSD': 'binancecoin', 'XRPUSD': 'ripple',
  'ADAUSD': 'cardano', 'SOLUSD': 'solana', 'DOGEUSD': 'dogecoin', 'DOTUSD': 'polkadot',
  'MATICUSD': 'matic-network', 'LTCUSD': 'litecoin', 'LINKUSD': 'chainlink', 'UNIUSD': 'uniswap',
  'AAVEUSD': 'aave', 'ALGOUSD': 'algorand', 'APTUSD': 'aptos', 'ARBUSD': 'arbitrum',
  'ARUSD': 'arweave', 'ATOMUSD': 'cosmos', 'AVAXUSD': 'avalanche-2', 'AXSUSD': 'axie-infinity',
  'COMPUSD': 'compound-governance-token', 'CROUSD': 'crypto-com-chain', 'CRVUSD': 'curve-dao-token', 'ENJUSD': 'enjincoin',
  'FTMUSD': 'fantom', 'GALAUSD': 'gala', 'GRTUSD': 'the-graph', 'ICPUSD': 'internet-computer',
  'IMXUSD': 'immutable-x', 'INJUSD': 'injective-protocol', 'LDOUSD': 'lido-dao', 'MANAUSD': 'decentraland',
  'NEARUSD': 'near', 'OPUSD': 'optimism', 'PEPEUSD': 'pepe', 'RNDRUSD': 'render-token',
  'SANDUSD': 'the-sandbox', 'SHIBUSD': 'shiba-inu', 'STXUSD': 'blockstack', 'SUIUSD': 'sui',
  'TIAUSD': 'celestia', 'TONUSD': 'the-open-network', 'TRXUSD': 'tron', 'UMAUSD': 'uma',
  'VETUSD': 'vechain', 'WLDUSD': 'worldcoin-wld', 'XLMUSD': 'stellar', 'XTZUSD': 'tezos',
  'FILUSD': 'filecoin'
};

const YAHOO_SYMBOLS: Record<string, string> = {
  // Forex
  'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X', 'USDJPY': 'JPY=X', 'USDCHF': 'CHF=X',
  'AUDUSD': 'AUDUSD=X', 'USDCAD': 'CAD=X', 'NZDUSD': 'NZDUSD=X', 'EURGBP': 'EURGBP=X',
  'EURJPY': 'EURJPY=X', 'GBPJPY': 'GBPJPY=X', 'EURCHF': 'EURCHF=X', 'AUDJPY': 'AUDJPY=X',
  'EURAUD': 'EURAUD=X', 'USDMXN': 'MXN=X', 'USDZAR': 'ZAR=X', 'USDHKD': 'HKD=X',
  'USDSGD': 'SGD=X', 'USDNOK': 'NOK=X', 'USDSEK': 'SEK=X', 'USDDKK': 'DKK=X',
  // Stocks
  'AAPL': 'AAPL', 'GOOGL': 'GOOGL', 'MSFT': 'MSFT', 'TSLA': 'TSLA', 'NVDA': 'NVDA',
  'AMZN': 'AMZN', 'META': 'META', 'NFLX': 'NFLX', 'AMD': 'AMD', 'INTC': 'INTC',
  'BABA': 'BABA', 'DIS': 'DIS', 'PYPL': 'PYPL',
  // Indices
  'US30': '^DJI', 'US100': '^IXIC', 'US500': '^GSPC', 'UK100': '^FTSE',
  'GER40': '^GDAXI', 'FRA40': '^FCHI', 'JPN225': '^N225', 'AUS200': '^AXJO',
  // Commodities
  'XAUUSD': 'GC=F', 'XAGUSD': 'SI=F', 'USOIL': 'CL=F', 'UKOIL': 'BZ=F',
  'NATGAS': 'NG=F', 'XPTUSD': 'PL=F', 'COPPER': 'HG=F'
};

// ==================== MASSIVE COST OPTIMIZATION ====================
// Real prices fetched every 10 minutes, simulated heartbeat every 2 seconds
const REAL_PRICE_INTERVAL = 600000;     // 10 minutes - fetch real prices from APIs
const HEARTBEAT_INTERVAL = 2000;        // 2 seconds - simulated price movements
const DB_PERSIST_INTERVAL = 600000;     // 10 minutes - only persist real prices

let realtimeChannel: any = null;
let presenceChannel: any = null;
let coingeckoPollingInterval: number | null = null;
let yahooPollingInterval: number | null = null;
let heartbeatInterval: number | null = null;
let connectionMode: 'websocket' | 'polling' | 'offline' = 'offline';

// Database update batching - only real prices
let pendingUpdates: Array<{symbol: string, price: number, change: number}> = [];
let dbUpdateInterval: number | null = null;

// User presence tracking for cost optimization
let activeUserCount = 0;
let isPollingActive = false;

// ==================== HEARTBEAT SIMULATION ====================
// Store real prices and current simulated prices
const realPrices: Map<string, { price: number; change_24h: number; lastRealUpdate: number }> = new Map();
const simulatedPrices: Map<string, number> = new Map();

// Volatility levels by asset type (per tick movement as percentage)
function getVolatilityForSymbol(symbol: string): number {
  // Crypto - higher volatility (0.1% per tick)
  if (COINGECKO_SYMBOLS[symbol]) return 0.001;
  
  // Forex - very low volatility (0.01% per tick)
  const forexSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 
                        'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY', 'EURAUD', 
                        'USDMXN', 'USDZAR', 'USDHKD', 'USDSGD', 'USDNOK', 'USDSEK', 'USDDKK'];
  if (forexSymbols.includes(symbol)) return 0.0001;
  
  // Commodities - medium-low volatility (0.03% per tick)
  const commodities = ['XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL', 'NATGAS', 'XPTUSD', 'COPPER'];
  if (commodities.includes(symbol)) return 0.0003;
  
  // Indices - low volatility (0.02% per tick)
  const indices = ['US30', 'US100', 'US500', 'UK100', 'GER40', 'FRA40', 'JPN225', 'AUS200'];
  if (indices.includes(symbol)) return 0.0002;
  
  // Stocks - medium volatility (0.05% per tick)
  return 0.0005;
}

// Generate a simulated price movement (random walk)
function generateHeartbeatPrice(symbol: string, basePrice: number): number {
  const volatility = getVolatilityForSymbol(symbol);
  
  // Random walk: price can move up or down slightly
  const direction = Math.random() > 0.5 ? 1 : -1;
  const magnitude = Math.random() * volatility;
  const newPrice = basePrice * (1 + direction * magnitude);
  
  // Determine decimal precision based on price magnitude
  if (newPrice < 0.01) return Number(newPrice.toPrecision(4));
  if (newPrice < 1) return Number(newPrice.toPrecision(5));
  if (newPrice < 100) return Number(newPrice.toFixed(4));
  if (newPrice < 10000) return Number(newPrice.toFixed(2));
  return Number(newPrice.toFixed(2));
}

async function broadcastPriceUpdate(symbol: string, price: number, change24h: number, source: string) {
  if (!realtimeChannel) {
    realtimeChannel = supabase.channel('price-updates');
    await realtimeChannel.subscribe();
  }
  await realtimeChannel.send({
    type: 'broadcast',
    event: 'price',
    payload: { 
      symbol, 
      price, 
      change_24h: change24h,
      timestamp: Date.now(), 
      source,
      mode: connectionMode 
    }
  });
  
  // Only queue REAL prices for database persistence (not simulated)
  if (source !== 'simulated') {
    pendingUpdates.push({ symbol, price, change: change24h });
  }
}

async function broadcastConnectionMode() {
  if (!realtimeChannel) {
    realtimeChannel = supabase.channel('price-updates');
    await realtimeChannel.subscribe();
  }
  await realtimeChannel.send({
    type: 'broadcast',
    event: 'connection_mode',
    payload: { mode: connectionMode, timestamp: Date.now() }
  });
}

// ==================== HEARTBEAT BROADCASTING ====================
async function broadcastHeartbeatPrices() {
  const symbols = [...realPrices.keys()];
  
  for (const symbol of symbols) {
    const realData = realPrices.get(symbol);
    if (!realData) continue;
    
    // Get current simulated price or use real price as base
    const currentSimulated = simulatedPrices.get(symbol) || realData.price;
    
    // Generate new simulated price based on last simulated (creates random walk effect)
    const newPrice = generateHeartbeatPrice(symbol, currentSimulated);
    simulatedPrices.set(symbol, newPrice);
    
    // Broadcast the simulated price
    await broadcastPriceUpdate(symbol, newPrice, realData.change_24h, 'simulated');
  }
  
  if (symbols.length > 0) {
    console.log(`💓 Heartbeat: Updated ${symbols.length} simulated prices`);
  }
}

function startHeartbeat() {
  if (heartbeatInterval) return;
  
  console.log(`💓 Starting heartbeat simulation (every ${HEARTBEAT_INTERVAL / 1000} seconds)...`);
  heartbeatInterval = setInterval(broadcastHeartbeatPrices, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('⏹️ Stopped heartbeat simulation');
  }
}

// ==================== REAL PRICE FETCHING ====================
// CoinGecko REST API Polling
async function fetchCoinGeckoPrices() {
  try {
    const coinIds = Object.values(COINGECKO_SYMBOLS).join(',');
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`
    );
    
    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    
    const coinGeckoReversed = Object.fromEntries(
      Object.entries(COINGECKO_SYMBOLS).map(([k, v]) => [v, k])
    );
    
    let updatedCount = 0;
    for (const [coinId, priceData] of Object.entries(data)) {
      const internalSymbol = coinGeckoReversed[coinId];
      if (internalSymbol && priceData && typeof priceData === 'object') {
        const price = priceData.usd;
        const change = priceData.usd_24h_change || 0;
        
        // Store real price
        realPrices.set(internalSymbol, { 
          price, 
          change_24h: change, 
          lastRealUpdate: Date.now() 
        });
        
        // Reset simulated price to real price
        simulatedPrices.set(internalSymbol, price);
        
        // Broadcast real price
        await broadcastPriceUpdate(internalSymbol, price, change, 'coingecko');
        updatedCount++;
      }
    }
    
    console.log(`📊 REAL prices: Updated ${updatedCount} CoinGecko crypto prices`);
  } catch (error) {
    console.error('❌ CoinGecko fetch error:', error);
  }
}

async function pollCoinGecko() {
  console.log('📊 Fetching REAL CoinGecko prices...');
  await fetchCoinGeckoPrices();
}

function startCoinGeckoPolling() {
  if (coingeckoPollingInterval) return;
  
  console.log(`🔄 Starting CoinGecko polling (every ${REAL_PRICE_INTERVAL / 60000} minutes)...`);
  pollCoinGecko();
  coingeckoPollingInterval = setInterval(pollCoinGecko, REAL_PRICE_INTERVAL);
}

function stopCoinGeckoPolling() {
  if (coingeckoPollingInterval) {
    clearInterval(coingeckoPollingInterval);
    coingeckoPollingInterval = null;
    console.log('⏹️ Stopped CoinGecko polling');
  }
}

// Yahoo Finance Polling Handler
async function fetchYahooPrice(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Yahoo Finance API error for ${symbol}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const result = data.chart.result[0];
    
    if (!result) return null;
    
    const price = result.meta.regularMarketPrice || result.meta.previousClose;
    const previousClose = result.meta.chartPreviousClose || result.meta.previousClose;
    const change = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;
    
    return { price, change };
  } catch (e) {
    console.error(`Yahoo fetch error for ${symbol}:`, e);
    return null;
  }
}

async function pollYahooFinance() {
  console.log('📊 Fetching REAL Yahoo Finance prices...');
  
  const symbols = Object.entries(YAHOO_SYMBOLS);
  const batchSize = 10;
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async ([internalSymbol, yahooSymbol]) => {
        const result = await fetchYahooPrice(yahooSymbol);
        if (result) {
          // Store real price
          realPrices.set(internalSymbol, {
            price: result.price,
            change_24h: result.change,
            lastRealUpdate: Date.now()
          });
          
          // Reset simulated price to real price
          simulatedPrices.set(internalSymbol, result.price);
          
          // Broadcast real price
          await broadcastPriceUpdate(internalSymbol, result.price, result.change, 'yahoo');
        }
      })
    );
    
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`📊 REAL prices: Updated Yahoo Finance (${symbols.length} symbols)`);
}

function startYahooPolling() {
  if (yahooPollingInterval) return;
  
  console.log(`🔄 Starting Yahoo Finance polling (every ${REAL_PRICE_INTERVAL / 60000} minutes)...`);
  connectionMode = 'polling';
  broadcastConnectionMode();
  
  pollYahooFinance();
  yahooPollingInterval = setInterval(pollYahooFinance, REAL_PRICE_INTERVAL);
}

function stopYahooPolling() {
  if (yahooPollingInterval) {
    clearInterval(yahooPollingInterval);
    yahooPollingInterval = null;
    console.log('⏹️ Stopped Yahoo Finance polling');
  }
}

// Persist prices to database in batches
async function flushPricesToDatabase() {
  if (pendingUpdates.length === 0) return;
  
  const updates = [...pendingUpdates];
  pendingUpdates = [];
  
  try {
    for (const update of updates) {
      await supabase
        .from('assets')
        .update({ 
          price: update.price, 
          change_24h: update.change, 
          price_updated_at: new Date().toISOString() 
        })
        .eq('symbol', update.symbol);
    }
    
    console.log(`📦 Persisted ${updates.length} REAL prices to database`);
  } catch (error) {
    console.error('❌ Database persistence error:', error);
  }
}

function startDatabasePersistence() {
  if (dbUpdateInterval) return;
  
  dbUpdateInterval = setInterval(flushPricesToDatabase, DB_PERSIST_INTERVAL);
  console.log(`💾 Database persistence enabled (every ${DB_PERSIST_INTERVAL / 60000} minutes)`);
}

function stopDatabasePersistence() {
  if (dbUpdateInterval) {
    flushPricesToDatabase();
    clearInterval(dbUpdateInterval);
    dbUpdateInterval = null;
    console.log('⏹️ Stopped database persistence');
  }
}

// ==================== PRESENCE-BASED COST CONTROL ====================
function startAllPolling() {
  if (isPollingActive) return;
  
  console.log('🟢 Starting price feeds with heartbeat simulation - users detected online');
  isPollingActive = true;
  connectionMode = 'polling';
  
  // Fetch real prices immediately, then every 10 minutes
  startCoinGeckoPolling();
  startYahooPolling();
  
  // Start heartbeat simulation after a short delay to ensure we have real prices
  setTimeout(() => {
    startHeartbeat();
  }, 3000);
  
  startDatabasePersistence();
}

function stopAllPolling() {
  if (!isPollingActive) return;
  
  console.log('🔴 Stopping all price feeds - no users online (SAVING COSTS!)');
  isPollingActive = false;
  connectionMode = 'offline';
  
  stopHeartbeat();
  stopCoinGeckoPolling();
  stopYahooPolling();
  stopDatabasePersistence();
  
  // Clear price caches
  realPrices.clear();
  simulatedPrices.clear();
  
  broadcastConnectionMode();
}

async function setupPresenceTracking() {
  if (presenceChannel) return;
  
  console.log('👥 Setting up user presence tracking...');
  
  presenceChannel = supabase.channel('price-relay-presence');
  
  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      const newCount = Object.keys(state).length;
      
      console.log(`👥 Presence sync: ${newCount} active users (was ${activeUserCount})`);
      
      if (newCount > 0 && activeUserCount === 0) {
        startAllPolling();
      } else if (newCount === 0 && activeUserCount > 0) {
        stopAllPolling();
      }
      
      activeUserCount = newCount;
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log(`👤 User joined: ${key}, total presences: ${newPresences.length}`);
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log(`👤 User left: ${key}`);
    })
    .subscribe((status) => {
      console.log(`📡 Presence channel status: ${status}`);
    });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  await setupPresenceTracking();
  
  let body = {};
  try {
    body = await req.json();
  } catch {
    // No body or invalid JSON
  }
  
  if (body.action === 'wake' && !isPollingActive) {
    console.log('⚡ Wake command received - starting polling immediately');
    startAllPolling();
  }
  
  return new Response(
    JSON.stringify({ 
      status: isPollingActive ? 'running' : 'idle',
      mode: connectionMode,
      active_users: activeUserCount,
      heartbeat_active: heartbeatInterval !== null,
      coingecko_polling: coingeckoPollingInterval !== null,
      yahoo_polling: yahooPollingInterval !== null,
      db_persistence: dbUpdateInterval !== null,
      real_prices_cached: realPrices.size,
      simulated_prices_cached: simulatedPrices.size,
      crypto_symbols: Object.keys(COINGECKO_SYMBOLS).length,
      yahoo_symbols: Object.keys(YAHOO_SYMBOLS).length,
      total_symbols: Object.keys(COINGECKO_SYMBOLS).length + Object.keys(YAHOO_SYMBOLS).length,
      cost_optimizations: {
        real_price_interval_minutes: REAL_PRICE_INTERVAL / 60000,
        heartbeat_interval_seconds: HEARTBEAT_INTERVAL / 1000,
        db_persist_interval_minutes: DB_PERSIST_INTERVAL / 60000,
        presence_based_polling: true,
        simulated_heartbeat: true
      },
      timestamp: Date.now()
    }), 
    { headers: { 'Content-Type': 'application/json', ...corsHeaders }}
  );
});
