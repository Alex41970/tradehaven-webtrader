import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
  source?: string;
}

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 426, headers: corsHeaders });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let isConnected = false;
  let priceInterval: number | null = null;
  let assets: any[] = [];
  let priceCache = new Map<string, PriceUpdate>();

  socket.onopen = async () => {
    console.log("🔌 Edge Function WebSocket connection opened - fallback data mode");
    isConnected = true;
    
    // Send heartbeat to confirm active connection
    socket.send(JSON.stringify({
      type: 'heartbeat',
      timestamp: Date.now(),
      client_id: crypto.randomUUID()
    }));
    
    // Fetch initial assets
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      assets = data || [];
      
      // Send initial prices
      const initialPrices: PriceUpdate[] = assets.map(asset => ({
        symbol: asset.symbol,
        price: asset.price,
        change_24h: asset.change_24h,
        timestamp: Date.now(),
        source: 'Database'
      }));
      
      socket.send(JSON.stringify({
        type: 'initial_prices',
        data: initialPrices,
        metadata: { source: 'EdgeFunction-Fallback' }
      }));
      
      console.log(`📊 Sent ${initialPrices.length} initial prices from database`);
      
      // Start REST API fallback updates
      startFallbackUpdates();
      
    } catch (error) {
      console.error('Error fetching initial assets:', error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to fetch initial data'
      }));
    }
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'heartbeat') {
        console.log(`💓 Received heartbeat from client ${message.client_id || 'unknown'}`);
        
        // Respond with heartbeat acknowledgment
        socket.send(JSON.stringify({
          type: 'heartbeat_ack',
          timestamp: Date.now(),
          client_active: true
        }));
      }
      
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  socket.onclose = () => {
    console.log("🔌 Edge Function WebSocket disconnected");
    isConnected = false;
    
    if (priceInterval !== null) {
      clearInterval(priceInterval);
      priceInterval = null;
    }
  };

  // REST API fallback functions
  const getCryptoPrices = async (symbols: string[]): Promise<Map<string, { price: number; change: number }>> => {
    const resultMap = new Map();
    
    try {
      // Use CoinGecko for crypto prices
      const cryptoSymbols = symbols.filter(s => ['BTCUSD', 'ETHUSD'].includes(s));
      if (cryptoSymbols.length === 0) return resultMap;
      
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');
      const data = await response.json();
      
      if (data.bitcoin) {
        resultMap.set('BTCUSD', { 
          price: data.bitcoin.usd, 
          change: data.bitcoin.usd_24h_change || 0 
        });
      }
      
      if (data.ethereum) {
        resultMap.set('ETHUSD', { 
          price: data.ethereum.usd, 
          change: data.ethereum.usd_24h_change || 0 
        });
      }
      
      console.log(`📊 CoinGecko REST: fetched ${resultMap.size} crypto prices`);
    } catch (error) {
      console.error('CoinGecko API error:', error);
    }
    
    return resultMap;
  };

  const getForexRates = async (): Promise<Map<string, { price: number; change: number }>> => {
    const resultMap = new Map();
    
    try {
      // Use exchangerate-api for forex (free tier)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();
      
      if (data.rates) {
        // Convert to standard forex pairs
        const rates = data.rates;
        if (rates.EUR) resultMap.set('EURUSD', { price: 1 / rates.EUR, change: 0 });
        if (rates.GBP) resultMap.set('GBPUSD', { price: 1 / rates.GBP, change: 0 });
        if (rates.JPY) resultMap.set('USDJPY', { price: rates.JPY, change: 0 });
      }
      
      console.log(`📊 Forex REST: fetched ${resultMap.size} forex rates`);
    } catch (error) {
      console.error('Forex API error:', error);
    }
    
    return resultMap;
  };

  const startFallbackUpdates = () => {
    // Update prices every 30 seconds using REST APIs
    priceInterval = setInterval(async () => {
      if (!isConnected) return;
      
      try {
        const assetSymbols = assets.map(a => a.symbol);
        const [cryptoMap, forexMap] = await Promise.all([
          getCryptoPrices(assetSymbols),
          getForexRates()
        ]);
        
        const allUpdates: PriceUpdate[] = [];
        
        // Process crypto updates
        cryptoMap.forEach((val, symbol) => {
          allUpdates.push({
            symbol,
            price: val.price,
            change_24h: val.change,
            timestamp: Date.now(),
            source: 'CoinGecko-REST'
          });
        });
        
        // Process forex updates
        forexMap.forEach((val, symbol) => {
          allUpdates.push({
            symbol,
            price: val.price,
            change_24h: val.change,
            timestamp: Date.now(),
            source: 'ExchangeRate-REST'
          });
        });
        
        if (allUpdates.length > 0) {
          socket.send(JSON.stringify({
            type: 'price_update',
            data: allUpdates,
            metadata: { 
              source: 'EdgeFunction-REST',
              fallback: true 
            }
          }));
          
          console.log(`📡 Sent ${allUpdates.length} fallback price updates`);
        }
        
      } catch (error) {
        console.error('Error updating fallback prices:', error);
      }
    }, 30000); // 30 second intervals for fallback data
  };

  return response;
});