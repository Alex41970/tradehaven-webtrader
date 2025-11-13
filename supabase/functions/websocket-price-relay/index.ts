import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Symbol mappings: Internal symbol -> API symbol
const BINANCE_SYMBOLS: Record<string, string> = {
  'BTCUSD': 'btcusdt', 'ETHUSD': 'ethusdt', 'BNBUSD': 'bnbusdt', 'XRPUSD': 'xrpusdt',
  'ADAUSD': 'adausdt', 'SOLUSD': 'solusdt', 'DOGEUSD': 'dogeusdt', 'DOTUSD': 'dotusdt',
  'MATICUSD': 'maticusdt', 'LTCUSD': 'ltcusdt', 'LINKUSD': 'linkusdt', 'UNIUSD': 'uniusdt',
  'AAVEUSD': 'aaveusdt', 'ALGOUSD': 'algousdt', 'APTUSD': 'aptusdt', 'ARBUSD': 'arbusdt',
  'ARUSD': 'arusdt', 'ATOMUSD': 'atomusdt', 'AVAXUSD': 'avaxusdt', 'AXSUSD': 'axsusdt',
  'COMPUSD': 'compusdt', 'CROUSD': 'crousdt', 'CRVUSD': 'crvusdt', 'ENJUSD': 'enjusdt',
  'FTMUSD': 'ftmusdt', 'GALAUSD': 'galausdt', 'GRTUSD': 'grtusdt', 'ICPUSD': 'icpusdt',
  'IMXUSD': 'imxusdt', 'INJUSD': 'injusdt', 'LDOUSD': 'ldousdt', 'MANAUSD': 'manausdt',
  'NEARUSD': 'nearusdt', 'OPUSD': 'opusdt', 'PEPEUSD': 'pepeusdt', 'RNDRUSD': 'rndrusdt',
  'SANDUSD': 'sandusdt', 'SHIBUSD': 'shibusdt', 'STXUSD': 'stxusdt', 'SUIUSD': 'suiusdt',
  'TIAUSD': 'tiausdt', 'TONUSD': 'tonusdt', 'TRXUSD': 'trxusdt', 'UMAUSD': 'umausdt',
  'VETUSD': 'vetusdt', 'WLDUSD': 'wldusdt', 'XLMUSD': 'xlmusdt', 'XTZUSD': 'xtzusdt'
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
  'XAUUSD': 'GC=F', 'XAGUSD': 'SI=F', 'WTIUSD': 'CL=F', 'BRENTUSD': 'BZ=F',
  'NGAS': 'NG=F', 'COPPER': 'HG=F'
};

let realtimeChannel: any = null;
let binancePollingInterval: number | null = null;
let yahooPollingInterval: number | null = null;
let connectionMode: 'websocket' | 'polling' | 'offline' = 'polling';

async function broadcastPriceUpdate(symbol: string, price: number, source: string) {
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
      timestamp: Date.now(), 
      source,
      mode: connectionMode 
    }
  });
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

// Binance REST API Polling
async function fetchBinancePrices() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    if (!response.ok) {
      console.error(`Binance API error: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    const binanceSymbolsReversed = Object.fromEntries(
      Object.entries(BINANCE_SYMBOLS).map(([k, v]) => [v.toUpperCase(), k])
    );
    
    let updatedCount = 0;
    for (const ticker of data) {
      const internalSymbol = binanceSymbolsReversed[ticker.symbol];
      if (internalSymbol) {
        const price = parseFloat(ticker.lastPrice);
        const change = parseFloat(ticker.priceChangePercent);
        await broadcastPriceUpdate(internalSymbol, price, 'binance');
        updatedCount++;
      }
    }
    
    console.log(`📊 Updated ${updatedCount} Binance prices`);
  } catch (error) {
    console.error('❌ Binance fetch error:', error);
  }
}

async function pollBinance() {
  console.log('📊 Polling Binance...');
  await fetchBinancePrices();
}

function startBinancePolling() {
  console.log('🔄 Starting Binance polling (every 2 seconds)...');
  pollBinance();
  binancePollingInterval = setInterval(pollBinance, 2000);
}

function stopBinancePolling() {
  if (binancePollingInterval) {
    clearInterval(binancePollingInterval);
    binancePollingInterval = null;
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
          await broadcastPriceUpdate(internalSymbol, result.price, 'yahoo');
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

// Initialize all price sources
function initializePriceSources() {
  console.log('🚀 Initializing multi-source price feed...');
  startBinancePolling();
  startYahooPolling();
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
  if (!binancePollingInterval && !yahooPollingInterval) {
    initializePriceSources();
  }
  
  return new Response(
    JSON.stringify({ 
      status: 'running', 
      mode: connectionMode,
      binance_polling: binancePollingInterval !== null,
      yahoo_polling: yahooPollingInterval !== null,
      binance_symbols: Object.keys(BINANCE_SYMBOLS).length,
      yahoo_symbols: Object.keys(YAHOO_SYMBOLS).length,
      total_symbols: Object.keys(BINANCE_SYMBOLS).length + Object.keys(YAHOO_SYMBOLS).length,
      timestamp: Date.now()
    }), 
    { headers: { 'Content-Type': 'application/json', ...corsHeaders }}
  );
});
