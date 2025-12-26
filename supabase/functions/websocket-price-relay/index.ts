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

// ==================== CONFIGURATION ====================
const REAL_PRICE_INTERVAL = 300000;     // 5 minutes (reduced from 10)
const LOCK_RENEWAL_INTERVAL = 15000;    // 15 seconds
const INSTANCE_ID = crypto.randomUUID().slice(0, 8);

// ==================== STATE ====================
let presenceChannel: any = null;
let coingeckoPollingInterval: number | null = null;
let yahooPollingInterval: number | null = null;
let lockRenewalInterval: number | null = null;
let connectionMode: 'polling' | 'offline' = 'offline';

let activeUserCount = 0;
let isCoordinator = false;

const realPrices: Map<string, { price: number; change_24h: number; lastRealUpdate: number }> = new Map();

// ==================== COORDINATOR LOCK ====================
async function tryBecomeCoordinator(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('try_acquire_coordinator_lock', {
      p_instance_id: INSTANCE_ID
    });
    
    if (error) {
      console.log(`⚠️ [${INSTANCE_ID}] Lock acquisition error: ${error.message}`);
      return false;
    }
    
    return data === true;
  } catch (e) {
    console.log(`⚠️ [${INSTANCE_ID}] Lock acquisition failed`);
    return false;
  }
}

async function renewLock(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('renew_coordinator_lock', {
      p_instance_id: INSTANCE_ID
    });
    
    if (error || !data) {
      console.log(`⚠️ [${INSTANCE_ID}] Lost coordinator lock - stopping`);
      await stopAllPolling();
      isCoordinator = false;
      return false;
    }
    
    return true;
  } catch {
    console.log(`⚠️ [${INSTANCE_ID}] Lock renewal failed - stopping`);
    await stopAllPolling();
    isCoordinator = false;
    return false;
  }
}

async function releaseLock(): Promise<void> {
  try {
    await supabase.rpc('release_coordinator_lock', {
      p_instance_id: INSTANCE_ID
    });
  } catch {
    // Silent fail - lock will expire anyway
  }
}

// ==================== DATABASE PERSISTENCE (IMMEDIATE) ====================
async function persistPrices(updates: Array<{symbol: string, price: number, change: number}>) {
  if (updates.length === 0) return;
  
  const timestamp = new Date().toISOString();
  let successCount = 0;
  
  try {
    // Batch update using Promise.all for speed
    const results = await Promise.all(
      updates.map(async (update) => {
        const { error } = await supabase
          .from('assets')
          .update({ 
            price: update.price, 
            change_24h: update.change, 
            price_updated_at: timestamp,
            price_source: 'live_api'
          })
          .eq('symbol', update.symbol);
        
        return error ? null : update.symbol;
      })
    );
    
    successCount = results.filter(r => r !== null).length;
    console.log(`💾 [${INSTANCE_ID}] Persisted ${successCount}/${updates.length} prices to DB`);
  } catch (e) {
    console.error(`❌ [${INSTANCE_ID}] DB persist failed: ${e}`);
  }
}

// ==================== REAL PRICE FETCHING ====================
async function fetchCoinGeckoPrices() {
  if (!isCoordinator) return;
  
  try {
    const coinIds = Object.values(COINGECKO_SYMBOLS).join(',');
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`
    );
    
    if (!response.ok) {
      console.error(`❌ [${INSTANCE_ID}] CoinGecko API error: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    const coinGeckoReversed = Object.fromEntries(
      Object.entries(COINGECKO_SYMBOLS).map(([k, v]) => [v, k])
    );
    
    const updates: Array<{symbol: string, price: number, change: number}> = [];
    
    for (const [coinId, priceData] of Object.entries(data)) {
      const internalSymbol = coinGeckoReversed[coinId];
      if (internalSymbol && priceData && typeof priceData === 'object') {
        const price = (priceData as any).usd;
        const change = (priceData as any).usd_24h_change || 0;
        
        realPrices.set(internalSymbol, { price, change_24h: change, lastRealUpdate: Date.now() });
        updates.push({ symbol: internalSymbol, price, change });
      }
    }
    
    console.log(`📊 [${INSTANCE_ID}] CoinGecko: ${updates.length} prices`);
    
    // Persist immediately after fetching
    await persistPrices(updates);
  } catch (e) {
    console.error(`❌ [${INSTANCE_ID}] CoinGecko fetch failed: ${e}`);
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
  if (!isCoordinator) return;
  
  const symbols = Object.entries(YAHOO_SYMBOLS);
  const batchSize = 10;
  const allUpdates: Array<{symbol: string, price: number, change: number}> = [];
  
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
          allUpdates.push({ symbol: internalSymbol, price: result.price, change: result.change });
        }
      })
    );
    
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`📊 [${INSTANCE_ID}] Yahoo: ${allUpdates.length} prices`);
  
  // Persist immediately after fetching
  await persistPrices(allUpdates);
}

function startYahooPolling() {
  if (yahooPollingInterval) return;
  
  connectionMode = 'polling';
  
  pollYahooFinance();
  yahooPollingInterval = setInterval(pollYahooFinance, REAL_PRICE_INTERVAL);
}

function stopYahooPolling() {
  if (yahooPollingInterval) {
    clearInterval(yahooPollingInterval);
    yahooPollingInterval = null;
  }
}

// ==================== COORDINATOR LIFECYCLE ====================

async function startAllPolling() {
  if (isCoordinator) return;
  
  // Try to become coordinator using database lock
  const acquired = await tryBecomeCoordinator();
  
  if (!acquired) {
    console.log(`🔇 [${INSTANCE_ID}] Not coordinator - another instance is active`);
    return;
  }
  
  console.log(`👑 [${INSTANCE_ID}] Became coordinator - starting price feeds`);
  isCoordinator = true;
  connectionMode = 'polling';
  
  // Start lock renewal
  lockRenewalInterval = setInterval(renewLock, LOCK_RENEWAL_INTERVAL);
  
  // Start all polling - prices persist immediately after each fetch
  startCoinGeckoPolling();
  startYahooPolling();
}

async function stopAllPolling() {
  if (!isCoordinator) return;
  
  console.log(`🔴 [${INSTANCE_ID}] Stopping coordinator - no users`);
  
  // Stop lock renewal
  if (lockRenewalInterval) {
    clearInterval(lockRenewalInterval);
    lockRenewalInterval = null;
  }
  
  // Release the lock
  await releaseLock();
  
  isCoordinator = false;
  connectionMode = 'offline';
  
  stopCoinGeckoPolling();
  stopYahooPolling();
  
  realPrices.clear();
}

// ==================== PRESENCE TRACKING ====================
async function setupPresenceTracking() {
  if (presenceChannel) return;
  
  presenceChannel = supabase.channel('price-relay-presence');
  
  presenceChannel
    .on('presence', { event: 'sync' }, async () => {
      const state = presenceChannel.presenceState();
      const newCount = Object.keys(state).length;
      
      if (newCount !== activeUserCount) {
        console.log(`👥 [${INSTANCE_ID}] Users: ${activeUserCount} → ${newCount}`);
        
        // User count: 0 → N (users came online)
        if (newCount > 0 && activeUserCount === 0) {
          await startAllPolling();
        } 
        // User count: N → 0 (all users left)
        else if (newCount === 0 && activeUserCount > 0) {
          await stopAllPolling();
        }
        
        activeUserCount = newCount;
      }
    })
    .subscribe();
}

// ==================== HTTP HANDLER ====================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  await setupPresenceTracking();
  
  return new Response(
    JSON.stringify({ 
      status: 'ok',
      instance: INSTANCE_ID,
      mode: connectionMode,
      activeUsers: activeUserCount,
      isCoordinator,
      priceCount: realPrices.size
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
