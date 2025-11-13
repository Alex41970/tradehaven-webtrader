import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWELVE_DATA_API_KEY = Deno.env.get('TWELVE_DATA_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SYMBOL_MAPPING: Record<string, string> = {
  'BTCUSD': 'BTC/USD', 'ETHUSD': 'ETH/USD', 'BNBUSD': 'BNB/USD', 'XRPUSD': 'XRP/USD',
  'ADAUSD': 'ADA/USD', 'SOLUSD': 'SOL/USD', 'DOGEUSD': 'DOGE/USD', 'DOTUSD': 'DOT/USD',
  'MATICUSD': 'MATIC/USD', 'LTCUSD': 'LTC/USD', 'LINKUSD': 'LINK/USD', 'UNIUSD': 'UNI/USD',
  'EURUSD': 'EUR/USD', 'GBPUSD': 'GBP/USD', 'USDJPY': 'USD/JPY', 'USDCHF': 'USD/CHF',
  'AAPL': 'AAPL', 'GOOGL': 'GOOGL', 'MSFT': 'MSFT', 'TSLA': 'TSLA', 'NVDA': 'NVDA',
  'XAUUSD': 'XAU/USD', 'XAGUSD': 'XAG/USD', 'WTIUSD': 'WTI/USD',
};

const FREE_TIER_SYMBOLS = ['BTC/USD', 'ETH/USD', 'BNB/USD', 'XRP/USD', 'SOL/USD', 'DOGE/USD'];

let realtimeChannel: any = null;
let pollingInterval: number | null = null;
let connectionMode: 'websocket' | 'polling' | 'offline' = 'polling';

async function broadcastPriceUpdate(symbol: string, price: number) {
  if (!realtimeChannel) {
    realtimeChannel = supabase.channel('price-updates');
    await realtimeChannel.subscribe();
  }
  await realtimeChannel.send({
    type: 'broadcast',
    event: 'price',
    payload: { symbol, price, timestamp: Date.now(), source: 'twelve_data', mode: connectionMode }
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

async function pollPrices() {
  try {
    const url = `https://api.twelvedata.com/price?symbol=${FREE_TIER_SYMBOLS.join(',')}&apikey=${TWELVE_DATA_API_KEY.trim()}`;
    const response = await fetch(url);
    const data = await response.json();
    const prices = Array.isArray(data) ? data : [data];
    
    for (const item of prices) {
      if (item.price) {
        const internal = Object.entries(SYMBOL_MAPPING).find(([_, td]) => td === item.symbol)?.[0];
        if (internal) await broadcastPriceUpdate(internal, parseFloat(item.price));
      }
    }
  } catch (e) {
    console.error('Polling error:', e);
  }
}

async function startPolling() {
  if (pollingInterval) return;
  
  console.log('🔄 Starting REST polling...');
  connectionMode = 'polling';
  await broadcastConnectionMode();
  
  await pollPrices();
  pollingInterval = setInterval(pollPrices, 15000);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (!pollingInterval) {
    startPolling();
  }
  
  return new Response(
    JSON.stringify({ 
      status: 'running', 
      mode: connectionMode,
      timestamp: Date.now()
    }), 
    { headers: { 'Content-Type': 'application/json', ...corsHeaders }}
  );
});
