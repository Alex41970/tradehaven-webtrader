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

let realtimeChannel: any = null;
let coingeckoPollingInterval: number | null = null;
let yahooPollingInterval: number | null = null;
let connectionMode: 'websocket' | 'polling' | 'offline' = 'polling';

// Database update batching
let pendingUpdates: Array<{symbol: string, price: number, change: number}> = [];
let dbUpdateInterval: number | null = null;

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
  
  // Queue for database persistence
  pendingUpdates.push({ symbol, price, change: change24h });
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

// CoinGecko REST API Polling
async function fetchCoinGeckoPrices() {
  try {
    // Get all coin IDs
    const coinIds = Object.values(COINGECKO_SYMBOLS).join(',');
    
    // Fetch prices with 24h change
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`
    );
    
    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    
    // Reverse mapping: CoinGecko ID -> Internal symbol
    const coinGeckoReversed = Object.fromEntries(
      Object.entries(COINGECKO_SYMBOLS).map(([k, v]) => [v, k])
    );
    
    let updatedCount = 0;
    for (const [coinId, priceData] of Object.entries(data)) {
      const internalSymbol = coinGeckoReversed[coinId];
      if (internalSymbol && priceData && typeof priceData === 'object') {
        const price = priceData.usd;
        const change = priceData.usd_24h_change || 0;
        await broadcastPriceUpdate(internalSymbol, price, change, 'coingecko');
        updatedCount++;
      }
    }
    
    console.log(`📊 Updated ${updatedCount} CoinGecko crypto prices`);
  } catch (error) {
    console.error('❌ CoinGecko fetch error:', error);
  }
}

async function pollCoinGecko() {
  console.log('📊 Polling CoinGecko...');
  await fetchCoinGeckoPrices();
}

function startCoinGeckoPolling() {
  console.log('🔄 Starting CoinGecko polling (every 30 seconds to respect rate limits)...');
  pollCoinGecko();
  coingeckoPollingInterval = setInterval(pollCoinGecko, 30000); // 30 seconds
}

function stopCoinGeckoPolling() {
  if (coingeckoPollingInterval) {
    clearInterval(coingeckoPollingInterval);
    coingeckoPollingInterval = null;
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
  console.log('📊 Polling Yahoo Finance...');
  
  const symbols = Object.entries(YAHOO_SYMBOLS);
  const batchSize = 10; // Process in batches to avoid overwhelming the API
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async ([internalSymbol, yahooSymbol]) => {
        const result = await fetchYahooPrice(yahooSymbol);
        if (result) {
          await broadcastPriceUpdate(internalSymbol, result.price, result.change, 'yahoo');
        }
      })
    );
    
    // Small delay between batches
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

function startYahooPolling() {
  if (yahooPollingInterval) return;
  
  console.log('🔄 Starting Yahoo Finance polling (every 3 seconds)...');
  connectionMode = 'polling';
  broadcastConnectionMode();
  
  // Initial fetch
  pollYahooFinance();
  
  // Poll every 3 seconds
  yahooPollingInterval = setInterval(pollYahooFinance, 3000);
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
    // Batch update assets table
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
    
    console.log(`📦 Persisted ${updates.length} prices to database`);
  } catch (error) {
    console.error('❌ Database persistence error:', error);
  }
}

// Initialize all price sources
function initializePriceSources() {
  console.log('🚀 Initializing multi-source price feed...');
  startCoinGeckoPolling();
  startYahooPolling();
  
  // Start database persistence interval (every 30 seconds)
  if (!dbUpdateInterval) {
    dbUpdateInterval = setInterval(flushPricesToDatabase, 30000);
    console.log('💾 Database persistence enabled (every 30 seconds)');
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Initialize on first request
  if (!coingeckoPollingInterval && !yahooPollingInterval) {
    initializePriceSources();
  }
  
  return new Response(
    JSON.stringify({ 
      status: 'running', 
      mode: connectionMode,
      coingecko_polling: coingeckoPollingInterval !== null,
      yahoo_polling: yahooPollingInterval !== null,
      crypto_symbols: Object.keys(COINGECKO_SYMBOLS).length,
      yahoo_symbols: Object.keys(YAHOO_SYMBOLS).length,
      total_symbols: Object.keys(COINGECKO_SYMBOLS).length + Object.keys(YAHOO_SYMBOLS).length,
      timestamp: Date.now()
    }), 
    { headers: { 'Content-Type': 'application/json', ...corsHeaders }}
  );
});
