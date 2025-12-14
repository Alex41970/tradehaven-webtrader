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

// ==================== COST OPTIMIZATION ====================
const REAL_PRICE_INTERVAL = 600000;     // 10 minutes
const HEARTBEAT_INTERVAL = 2000;        // 2 seconds
const DB_PERSIST_INTERVAL = 600000;     // 10 minutes
const HEARTBEAT_LOG_INTERVAL = 30000;   // Log heartbeat every 30 seconds only
const INSTANCE_ID = crypto.randomUUID().slice(0, 8);

let realtimeChannel: any = null;
let presenceChannel: any = null;
let coingeckoPollingInterval: number | null = null;
let yahooPollingInterval: number | null = null;
let heartbeatInterval: number | null = null;
let connectionMode: 'websocket' | 'polling' | 'offline' = 'offline';

// Database update batching
let pendingUpdates: Map<string, {price: number, change: number}> = new Map();
let dbUpdateInterval: number | null = null;
let lastDbFlush: number = 0;

// User presence tracking
let activeUserCount = 0;
let isPollingActive = false;
let wasWokenDirectly = false; // Track if this instance was woken by a direct command

// Heartbeat simulation state
const realPrices: Map<string, { price: number; change_24h: number; lastRealUpdate: number }> = new Map();
const simulatedPrices: Map<string, number> = new Map();
let lastHeartbeatLog = 0;

function getVolatilityForSymbol(symbol: string): number {
  if (COINGECKO_SYMBOLS[symbol]) return 0.001;
  
  const forexSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 
                        'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY', 'EURAUD', 
                        'USDMXN', 'USDZAR', 'USDHKD', 'USDSGD', 'USDNOK', 'USDSEK', 'USDDKK'];
  if (forexSymbols.includes(symbol)) return 0.0001;
  
  const commodities = ['XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL', 'NATGAS', 'XPTUSD', 'COPPER'];
  if (commodities.includes(symbol)) return 0.0003;
  
  const indices = ['US30', 'US100', 'US500', 'UK100', 'GER40', 'FRA40', 'JPN225', 'AUS200'];
  if (indices.includes(symbol)) return 0.0002;
  
  return 0.0005;
}

function generateHeartbeatPrice(symbol: string, basePrice: number): number {
  const volatility = getVolatilityForSymbol(symbol);
  const direction = Math.random() > 0.5 ? 1 : -1;
  const magnitude = Math.random() * volatility;
  const newPrice = basePrice * (1 + direction * magnitude);
  
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
  
  if (source !== 'simulated') {
    pendingUpdates.set(symbol, { price, change: change24h });
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

// ==================== HEARTBEAT (Only for directly woken instances) ====================
async function broadcastHeartbeatPrices() {
  // Only instances that were woken directly can broadcast heartbeats
  // This prevents multiple instances from all broadcasting
  if (!wasWokenDirectly) {
    return;
  }
  
  const symbols = [...realPrices.keys()];
  if (symbols.length === 0) return;
  
  for (const symbol of symbols) {
    const realData = realPrices.get(symbol);
    if (!realData) continue;
    
    const currentSimulated = simulatedPrices.get(symbol) || realData.price;
    const newPrice = generateHeartbeatPrice(symbol, currentSimulated);
    simulatedPrices.set(symbol, newPrice);
    
    await broadcastPriceUpdate(symbol, newPrice, realData.change_24h, 'simulated');
  }
  
  // Only log every 30 seconds to reduce log spam
  const now = Date.now();
  if (now - lastHeartbeatLog >= HEARTBEAT_LOG_INTERVAL) {
    console.log(`💓 [${INSTANCE_ID}] Heartbeat: ${symbols.length} prices${wasWokenDirectly ? ' (coordinator)' : ''}`);
    lastHeartbeatLog = now;
  }
}

function startHeartbeat() {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(broadcastHeartbeatPrices, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ==================== REAL PRICE FETCHING ====================
async function fetchCoinGeckoPrices() {
  try {
    const coinIds = Object.values(COINGECKO_SYMBOLS).join(',');
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`
    );
    
    if (!response.ok) return;
    
    const data = await response.json();
    const coinGeckoReversed = Object.fromEntries(
      Object.entries(COINGECKO_SYMBOLS).map(([k, v]) => [v, k])
    );
    
    let updatedCount = 0;
    for (const [coinId, priceData] of Object.entries(data)) {
      const internalSymbol = coinGeckoReversed[coinId];
      if (internalSymbol && priceData && typeof priceData === 'object') {
        const price = (priceData as any).usd;
        const change = (priceData as any).usd_24h_change || 0;
        
        realPrices.set(internalSymbol, { price, change_24h: change, lastRealUpdate: Date.now() });
        simulatedPrices.set(internalSymbol, price);
        await broadcastPriceUpdate(internalSymbol, price, change, 'coingecko');
        updatedCount++;
      }
    }
    
    console.log(`📊 [${INSTANCE_ID}] CoinGecko: ${updatedCount} prices`);
  } catch {
    // Silent fail - will retry next interval
  }
}

function startCoinGeckoPolling() {
  if (coingeckoPollingInterval) return;
  
  fetchCoinGeckoPrices();
  coingeckoPollingInterval = setInterval(fetchCoinGeckoPrices, REAL_PRICE_INTERVAL);
}

function stopCoinGeckoPolling() {
  if (coingeckoPollingInterval) {
    clearInterval(coingeckoPollingInterval);
    coingeckoPollingInterval = null;
  }
}

async function fetchYahooPrice(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
    const response = await fetch(url);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart.result[0];
    if (!result) return null;
    
    const price = result.meta.regularMarketPrice || result.meta.previousClose;
    const previousClose = result.meta.chartPreviousClose || result.meta.previousClose;
    const change = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;
    
    return { price, change };
  } catch {
    return null;
  }
}

async function pollYahooFinance() {
  const symbols = Object.entries(YAHOO_SYMBOLS);
  const batchSize = 10;
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async ([internalSymbol, yahooSymbol]) => {
        const result = await fetchYahooPrice(yahooSymbol);
        if (result) {
          realPrices.set(internalSymbol, {
            price: result.price,
            change_24h: result.change,
            lastRealUpdate: Date.now()
          });
          simulatedPrices.set(internalSymbol, result.price);
          await broadcastPriceUpdate(internalSymbol, result.price, result.change, 'yahoo');
        }
      })
    );
    
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`📊 [${INSTANCE_ID}] Yahoo: ${symbols.length} prices`);
}

function startYahooPolling() {
  if (yahooPollingInterval) return;
  
  connectionMode = 'polling';
  broadcastConnectionMode();
  
  pollYahooFinance();
  yahooPollingInterval = setInterval(pollYahooFinance, REAL_PRICE_INTERVAL);
}

function stopYahooPolling() {
  if (yahooPollingInterval) {
    clearInterval(yahooPollingInterval);
    yahooPollingInterval = null;
  }
}

async function flushPricesToDatabase() {
  if (pendingUpdates.size === 0) return;
  
  const now = Date.now();
  if (now - lastDbFlush < 60000) return;
  lastDbFlush = now;
  
  const updates = Array.from(pendingUpdates.entries()).map(([symbol, data]) => ({
    symbol, price: data.price, change: data.change
  }));
  pendingUpdates.clear();
  
  try {
    for (const update of updates) {
      await supabase
        .from('assets')
        .update({ price: update.price, change_24h: update.change, price_updated_at: new Date().toISOString() })
        .eq('symbol', update.symbol);
    }
    console.log(`💾 [${INSTANCE_ID}] Persisted ${updates.length} prices`);
  } catch {
    // Silent fail
  }
}

function startDatabasePersistence() {
  if (dbUpdateInterval) return;
  dbUpdateInterval = setInterval(flushPricesToDatabase, DB_PERSIST_INTERVAL);
}

function stopDatabasePersistence() {
  if (dbUpdateInterval) {
    flushPricesToDatabase();
    clearInterval(dbUpdateInterval);
    dbUpdateInterval = null;
  }
}

// ==================== PRESENCE-BASED CONTROL ====================
function startAllPolling() {
  if (isPollingActive) return;
  
  console.log(`🟢 [${INSTANCE_ID}] Starting price feeds`);
  isPollingActive = true;
  connectionMode = 'polling';
  
  startCoinGeckoPolling();
  startYahooPolling();
  
  // Start heartbeat after prices are loaded
  setTimeout(startHeartbeat, 3000);
  startDatabasePersistence();
}

function stopAllPolling() {
  if (!isPollingActive) return;
  
  console.log(`🔴 [${INSTANCE_ID}] Stopping - no users (SAVING COSTS)`);
  isPollingActive = false;
  connectionMode = 'offline';
  wasWokenDirectly = false;
  
  stopHeartbeat();
  stopCoinGeckoPolling();
  stopYahooPolling();
  stopDatabasePersistence();
  
  realPrices.clear();
  simulatedPrices.clear();
  broadcastConnectionMode();
}

async function setupPresenceTracking() {
  if (presenceChannel) return;
  
  presenceChannel = supabase.channel('price-relay-presence');
  
  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      const newCount = Object.keys(state).length;
      
      if (newCount !== activeUserCount) {
        console.log(`👥 [${INSTANCE_ID}] Users: ${activeUserCount} → ${newCount}`);
        
        if (newCount > 0 && activeUserCount === 0) {
          startAllPolling();
        } else if (newCount === 0 && activeUserCount > 0) {
          stopAllPolling();
        }
        
        activeUserCount = newCount;
      }
    })
    .subscribe();
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
  
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // No body
  }
  
  // Mark this instance as directly woken - only direct wakes can become coordinator
  if ((body.action === 'wake' || body.action === 'ping') && !isPollingActive) {
    wasWokenDirectly = true;
    console.log(`⚡ [${INSTANCE_ID}] Wake command (will become coordinator)`);
    startAllPolling();
  }
  
  return new Response(
    JSON.stringify({ 
      status: 'ok',
      instance: INSTANCE_ID,
      mode: connectionMode,
      activeUsers: activeUserCount,
      isCoordinator: wasWokenDirectly,
      priceCount: realPrices.size
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
