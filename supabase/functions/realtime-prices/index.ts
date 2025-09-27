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
  let heartbeatInterval: number | null = null;
  let clientHeartbeatInterval: number | null = null;
  let lastHeartbeat = Date.now();
  let assets: any[] = [];

  socket.onopen = async () => {
    console.log("🔌 WebSocket connection opened - tracking active client");
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
        timestamp: Date.now()
      }));
      
      socket.send(JSON.stringify({
        type: 'initial_prices',
        data: initialPrices
      }));
      
  let lastHeartbeat = Date.now();
  let heartbeatInterval: number | null = null;

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'heartbeat') {
        console.log(`💓 Received heartbeat from client ${message.client_id || 'unknown'}`);
        lastHeartbeat = Date.now();
        
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

  // Set up heartbeat monitoring
  heartbeatInterval = setInterval(() => {
    const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;
    
    // If no heartbeat for 90 seconds, consider client inactive
    if (timeSinceLastHeartbeat > 90000) {
      console.log(`💔 Client appears inactive (${Math.floor(timeSinceLastHeartbeat/1000)}s since last heartbeat) - pausing price updates`);
      
      // Stop sending price updates to inactive client
      if (priceInterval) {
        clearInterval(priceInterval);
        priceInterval = null;
        console.log('⏸️ Price updates paused for inactive client');
      }
    } else if (!priceInterval && isConnected) {
      // Restart price updates for active client
      console.log('💓 Client is active - resuming price updates');
      priceInterval = setInterval(() => {
        if (isConnected) {
          sendPriceUpdates();
        }
      }, 1000); // 1-second updates for active users
    }
  }, 30000); // Check every 30 seconds

  // Send periodic heartbeats to client
  const clientHeartbeatInterval = setInterval(() => {
    if (isConnected) {
      socket.send(JSON.stringify({
        type: 'server_heartbeat',
        timestamp: Date.now(),
        active_connections: 1 // Could track multiple connections in the future
      }));
    }
  }, 60000); // Send heartbeat every minute
      priceInterval = setInterval(() => {
        if (isConnected) {
          sendPriceUpdates();
        }
      }, 1000); // 1-second updates for active users
      
    } catch (error) {
      console.error('Error fetching assets:', error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to fetch initial data'
      }));
    }
  };

  // Optimized cache for reduced message volume 
  let priceCache = new Map<string, { price: number; change: number; timestamp: number }>();
  let lastApiCall = 0;
  const API_CACHE_DURATION = 1000; // 1 second for ultra-fast AllTick updates
  const PRICE_CHANGE_THRESHOLD = 0.01; // Only send updates if price changed by 0.01% or more
  
  // AllTick API integration for ultra-high frequency data (170ms latency)
  const getAllTickPrices = async (symbols: string[]): Promise<Map<string, { price: number; change: number; source: string }>> => {
    const allTickApiKey = Deno.env.get('ALLTICK_API_KEY');
    if (!allTickApiKey) {
      console.log('AllTick API key not available, using fallback sources');
      return new Map();
    }

    const prices = new Map();
    
    try {
      console.log('Fetching from AllTick API (170ms latency):', symbols.join(', '));
      
      // AllTick provides real-time data for multiple asset types
      for (const symbol of symbols) {
        try {
          // AllTick symbol mapping for different asset types
          let allTickSymbol = symbol;
          
          // Map crypto symbols for AllTick
          if (symbol.endsWith('USD')) {
            if (symbol === 'BTCUSD') allTickSymbol = 'BTC/USD';
            else if (symbol === 'ETHUSD') allTickSymbol = 'ETH/USD';
            else if (symbol === 'XRPUSD') allTickSymbol = 'XRP/USD';
            else if (symbol === 'ADAUSD') allTickSymbol = 'ADA/USD';
            else if (symbol === 'DOTUSD') allTickSymbol = 'DOT/USD';
            else if (symbol === 'BNBUSD') allTickSymbol = 'BNB/USD';
            else if (symbol === 'LINKUSD') allTickSymbol = 'LINK/USD';
            else if (symbol === 'LTCUSD') allTickSymbol = 'LTC/USD';
            else if (symbol === 'MATICUSD') allTickSymbol = 'MATIC/USD';
            else if (symbol === 'SOLUSD') allTickSymbol = 'SOL/USD';
          }
          
          const response = await fetch(`https://quote-api.alltick.co/quote?token=${allTickApiKey}&code=${allTickSymbol}`, {
            method: 'GET',
            headers: {
              'User-Agent': 'TradingBot/1.0'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.data && data.data.length > 0) {
              const quote = data.data[0];
              const currentPrice = parseFloat(quote.latest_price || quote.price);
              const previousClose = parseFloat(quote.prev_close || quote.previous_close);
              
              if (!isNaN(currentPrice) && currentPrice > 0) {
                const change24h = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
                
                prices.set(symbol, {
                  price: parseFloat(currentPrice.toFixed(6)),
                  change: parseFloat(change24h.toFixed(4)),
                  source: 'AllTick'
                });
                
                console.log(`AllTick REAL price update: ${symbol} = $${currentPrice} (${change24h.toFixed(2)}%)`);
              }
            }
          }
          
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.log(`AllTick error for ${symbol}:`, error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      console.error('AllTick API error:', error);
    }
    
    return prices;
  };

  // Helper function to get yesterday's price from our database as fallback
  const getYesterdayPriceFromDB = async (symbol: string): Promise<number | null> => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('price_history')
        .select('price')
        .eq('symbol', symbol)
        .eq('snapshot_date', yesterdayDate)
        .single();
      
      if (error || !data) {
        console.log(`No historical data found for ${symbol} on ${yesterdayDate}`);
        return null;
      }
      
      console.log(`Using historical fallback for ${symbol}: yesterday price = ${data.price}`);
      return data.price;
    } catch (error) {
      console.error(`Error fetching historical price for ${symbol}:`, error);
      return null;
    }
  };
  
  // Helper function to get crypto prices from Yahoo Finance (fallback)
  const getCryptoPrices = async (symbols: string[]): Promise<Map<string, { price: number; change: number }>> => {
    const cryptoMap = new Map();
    const yahooSymbols: Record<string, string> = {
      'BTCUSD': 'BTC-USD',
      'ETHUSD': 'ETH-USD', 
      'XRPUSD': 'XRP-USD',
      'ADAUSD': 'ADA-USD',
      'DOTUSD': 'DOT-USD',
      'BNBUSD': 'BNB-USD',
      'LINKUSD': 'LINK-USD',
      'LTCUSD': 'LTC-USD',
      'MATICUSD': 'MATIC-USD',
      'SOLUSD': 'SOL-USD'
    };

    const cryptoSymbols = symbols.filter(s => yahooSymbols[s]);
    if (cryptoSymbols.length === 0) return cryptoMap;
    
    try {
      console.log(`Fallback: Fetching crypto from Yahoo Finance: ${cryptoSymbols.join(', ')}`);
      
      for (const symbol of cryptoSymbols) {
        const yahooSymbol = yahooSymbols[symbol];
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            const result = data.chart?.result?.[0];
            
            if (result?.meta?.regularMarketPrice) {
              const currentPrice = result.meta.regularMarketPrice;
              let previousClose = result.meta.previousClose;
              
              // Fallback: Use our historical data if Yahoo doesn't have previousClose
              if (!previousClose || previousClose === currentPrice) {
                console.log(`No previousClose for ${symbol}, trying historical fallback...`);
                const historicalPrice = await getYesterdayPriceFromDB(symbol);
                if (historicalPrice) {
                  previousClose = historicalPrice;
                } else {
                  previousClose = currentPrice; // Last resort: no change
                }
              }
              
              const change24h = ((currentPrice - previousClose) / previousClose) * 100;
              
              cryptoMap.set(symbol, { 
                price: parseFloat(currentPrice.toFixed(6)), 
                change: parseFloat(change24h.toFixed(2)) 
              });
              
              console.log(`Yahoo Finance crypto: ${symbol} = $${currentPrice} (${change24h.toFixed(2)}%)`);
            }
          }
        } catch (error) {
          console.error(`Yahoo Finance crypto error for ${symbol}:`, error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      console.error('Yahoo Finance crypto API error:', error);
    }
    
    return cryptoMap;
  };

  // Helper function to get real forex rates with 24h change from Yahoo Finance (fallback)
  const getForexRates = async (): Promise<Map<string, { price: number; change: number }>> => {
    const ratesMap = new Map();
    
    try {
      console.log('Fallback: Fetching forex from Yahoo Finance');
      
      const forexPairs = {
        'EURUSD': 'EURUSD=X',
        'GBPUSD': 'GBPUSD=X',
        'AUDUSD': 'AUDUSD=X',
        'NZDUSD': 'NZDUSD=X',
        'USDCAD': 'USDCAD=X',
        'USDCHF': 'USDCHF=X',
        'USDJPY': 'USDJPY=X',
        'EURGBP': 'EURGBP=X',
        'EURJPY': 'EURJPY=X',
        'GBPJPY': 'GBPJPY=X'
      };

      for (const [symbol, yahooSymbol] of Object.entries(forexPairs)) {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            const result = data.chart?.result?.[0];
            
            if (result?.meta?.regularMarketPrice) {
              const currentPrice = result.meta.regularMarketPrice;
              let previousClose = result.meta.previousClose;
              
              // Fallback: Use our historical data if Yahoo doesn't have previousClose
              if (!previousClose || previousClose === currentPrice) {
                console.log(`No previousClose for ${symbol}, trying historical fallback...`);
                const historicalPrice = await getYesterdayPriceFromDB(symbol);
                if (historicalPrice) {
                  previousClose = historicalPrice;
                } else {
                  previousClose = currentPrice; // Last resort: no change
                }
              }
              
              const change24h = ((currentPrice - previousClose) / previousClose) * 100;
              
              ratesMap.set(symbol, { 
                price: parseFloat(currentPrice.toFixed(5)), 
                change: parseFloat(change24h.toFixed(4)) 
              });
              
              console.log(`Yahoo Finance forex: ${symbol} = ${currentPrice.toFixed(5)} (${change24h.toFixed(2)}%)`);
            }
          }
        } catch (error) {
          console.error(`Yahoo Finance forex error for ${symbol}:`, error instanceof Error ? error.message : String(error));
        }
      }
      
      console.log(`Yahoo Finance forex rates fetched: ${Array.from(ratesMap.keys()).join(', ')}`);
    } catch (error) {
      console.error('Yahoo Finance forex API error:', error);
    }
    
    return ratesMap;
  };

  // Helper function to get REAL commodity prices from multiple sources (fallback)
  const getCommodityPrices = async (): Promise<Map<string, { price: number; change: number }>> => {
    const commodityMap = new Map();
    
    console.log('Fallback: Fetching commodities from multiple sources');
    
    // Try multiple data sources for commodity prices
    await Promise.allSettled([
      fetchFromYahooFinance(commodityMap),
      fetchFromAlphaVantage(commodityMap),
      fetchFromFinnhub(commodityMap)
    ]);
    
    console.log('Successfully fetched REAL commodity prices:', 
      Array.from(commodityMap.entries()).map(([symbol, data]) => `${symbol}: $${data.price}`).join(', '));
    
    return commodityMap;
  };

  // Fetch from Yahoo Finance API (free, reliable)
  const fetchFromYahooFinance = async (commodityMap: Map<string, { price: number; change: number }>) => {
    try {
      const symbols = {
        'CL=F': 'WTIUSD',    // WTI Crude Oil
        'BZ=F': 'BCOUSD',    // Brent Oil
        'NG=F': 'NATGAS',    // Natural Gas
        'GC=F': 'XAUUSD',    // Gold
        'SI=F': 'XAGUSD',    // Silver
        'PL=F': 'XPTUSD',    // Platinum
        'PA=F': 'XPDUSD'     // Palladium
      };
      
      for (const [yahooSymbol, ourSymbol] of Object.entries(symbols)) {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            const result = data.chart?.result?.[0];
            
            if (result?.meta?.regularMarketPrice) {
              const currentPrice = result.meta.regularMarketPrice;
              let previousClose = result.meta.previousClose;
              
              // Fallback: Use our historical data if Yahoo doesn't have previousClose
              if (!previousClose || previousClose === currentPrice) {
                console.log(`No previousClose for ${ourSymbol}, trying historical fallback...`);
                const historicalPrice = await getYesterdayPriceFromDB(ourSymbol);
                if (historicalPrice) {
                  previousClose = historicalPrice;
                } else {
                  previousClose = currentPrice; // Last resort: no change
                }
              }
              
              const change24h = ((currentPrice - previousClose) / previousClose) * 100;
              
              commodityMap.set(ourSymbol, { 
                price: parseFloat(currentPrice.toFixed(4)), 
                change: parseFloat(change24h.toFixed(2)) 
              });
              
              console.log(`Yahoo Finance: ${ourSymbol} = $${currentPrice} (${change24h.toFixed(2)}%)`);
            }
          }
        } catch (error) {
          console.error(`Yahoo Finance error for ${ourSymbol}:`, error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      console.error('Yahoo Finance API error:', error);
    }
  };

  // Fetch from Alpha Vantage (backup)
  const fetchFromAlphaVantage = async (commodityMap: Map<string, { price: number; change: number }>) => {
    const apiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
    if (!apiKey) {
      console.log('Alpha Vantage: No API key available');
      return;
    }

    try {
      // Alpha Vantage commodity functions
      const endpoints = {
        'WTIUSD': 'WTI',
        'BCOUSD': 'BRENT', 
        'NATGAS': 'NATURAL_GAS'
      };
      
      for (const [symbol, func] of Object.entries(endpoints)) {
        if (commodityMap.has(symbol)) continue; // Skip if already have data
        
        try {
          const response = await fetch(
            `https://www.alphavantage.co/query?function=${func}&interval=daily&apikey=${apiKey}`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.length > 0) {
              const current = parseFloat(data.data[0].value);
              const previous = data.data.length > 1 ? parseFloat(data.data[1].value) : current;
              const change24h = ((current - previous) / previous) * 100;
              
              commodityMap.set(symbol, { price: current, change: change24h });
              console.log(`Alpha Vantage: ${symbol} = $${current} (${change24h.toFixed(2)}%)`);
            }
          }
        } catch (error) {
          console.error(`Alpha Vantage error for ${symbol}:`, error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      console.error('Alpha Vantage API error:', error);
    }
  };

  // Fetch from Finnhub (another backup)
  const fetchFromFinnhub = async (commodityMap: Map<string, { price: number; change: number }>) => {
    try {
      // Finnhub has free tier for basic commodity data
      const symbols = {
        'OANDA:WTIUSD': 'WTIUSD',
        'OANDA:BCOUSD': 'BCOUSD', 
        'OANDA:NATGASUSD': 'NATGAS',
        'OANDA:XAUUSD': 'XAUUSD',
        'OANDA:XAGUSD': 'XAGUSD'
      };
      
      for (const [finnhubSymbol, ourSymbol] of Object.entries(symbols)) {
        if (commodityMap.has(ourSymbol)) continue; // Skip if already have data
        
        try {
          // Use demo token for now - users can add their own token as secret
          const response = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${finnhubSymbol}&token=demo`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.c && data.pc) {
              const current = data.c; // Current price
              const previousClose = data.pc; // Previous close
              const change24h = ((current - previousClose) / previousClose) * 100;
              
              commodityMap.set(ourSymbol, { 
                price: parseFloat(current.toFixed(4)), 
                change: parseFloat(change24h.toFixed(2)) 
              });
              
              console.log(`Finnhub: ${ourSymbol} = $${current} (${change24h.toFixed(2)}%)`);
            }
          }
        } catch (error) {
          console.error(`Finnhub error for ${ourSymbol}:`, error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      console.error('Finnhub API error:', error);
    }
  };

  // Keep track of last sent prices to implement smart batching
  let lastSentPrices = new Map<string, { price: number; timestamp: number }>();

  const sendPriceUpdates = async () => {
    try {
      const now = Date.now();
      
      // Fetch fresh REAL prices from APIs with ultra-fast frequency (every 1 second)
      if (now - lastApiCall > API_CACHE_DURATION) {
        console.log('Refreshing REAL prices from APIs with AllTick priority...');
        lastApiCall = now;
        
        // Get all symbols for AllTick (primary source)
        const allSymbols = assets.map(a => a.symbol);
        
        // Step 1: Try AllTick first for all symbols (ultra-high frequency)
        const allTickPrices = await getAllTickPrices(allSymbols);
        
        // Step 2: Update price cache and assets with AllTick data
        allTickPrices.forEach((data, symbol) => {
          priceCache.set(symbol, { price: data.price, change: data.change, timestamp: now });
          const assetIndex = assets.findIndex(a => a.symbol === symbol);
          if (assetIndex !== -1) {
            console.log(`AllTick REAL price update: ${symbol} = $${data.price} (${data.change.toFixed(2)}%)`);
            assets[assetIndex].price = data.price;
            assets[assetIndex].change_24h = data.change;
          }
        });
        
        // Step 3: Get symbols still missing data for fallback sources
        const missingCryptoSymbols = assets
          .filter(a => a.category === 'crypto' && !allTickPrices.has(a.symbol))
          .map(a => a.symbol);
        
        const missingForexSymbols = assets
          .filter(a => a.category === 'forex' && !allTickPrices.has(a.symbol))
          .map(a => a.symbol);
          
        const missingCommoditySymbols = assets
          .filter(a => a.category === 'commodities' && !allTickPrices.has(a.symbol))
          .map(a => a.symbol);
        
        try {
          // Step 4: Fallback to Yahoo Finance for missing prices
          const fallbackResults = await Promise.allSettled([
            missingCryptoSymbols.length > 0 ? getCryptoPrices(missingCryptoSymbols) : Promise.resolve(new Map()),
            missingForexSymbols.length > 0 ? getForexRates() : Promise.resolve(new Map()),
            missingCommoditySymbols.length > 0 ? getCommodityPrices() : Promise.resolve(new Map())
          ]);
          
          const [cryptoResult, forexResult, commodityResult] = fallbackResults;
          
          // Process fallback crypto prices
          if (cryptoResult.status === 'fulfilled') {
            const cryptoPrices = cryptoResult.value;
            cryptoPrices.forEach((data, symbol) => {
              if (missingCryptoSymbols.includes(symbol)) {
                priceCache.set(symbol, { ...data, timestamp: now });
                const assetIndex = assets.findIndex(a => a.symbol === symbol);
                if (assetIndex !== -1) {
                  assets[assetIndex].price = data.price;
                  assets[assetIndex].change_24h = data.change;
                }
              }
            });
          }
          
          // Process fallback forex rates
          if (forexResult.status === 'fulfilled') {
            const forexRates = forexResult.value;
            forexRates.forEach((data, symbol) => {
              if (missingForexSymbols.includes(symbol)) {
                priceCache.set(symbol, { price: data.price, change: data.change, timestamp: now });
                const assetIndex = assets.findIndex(a => a.symbol === symbol);
                if (assetIndex !== -1) {
                  console.log(`REAL forex rate update: ${symbol} = ${data.price} (${data.change.toFixed(2)}%)`);
                  assets[assetIndex].price = data.price;
                  assets[assetIndex].change_24h = data.change;
                }
              }
            });
          }
          
          // Process fallback commodity prices
          if (commodityResult.status === 'fulfilled') {
            const commodityPrices = commodityResult.value;
            commodityPrices.forEach((data, symbol) => {
              if (missingCommoditySymbols.includes(symbol)) {
                priceCache.set(symbol, { ...data, timestamp: now });
                const assetIndex = assets.findIndex(a => a.symbol === symbol);
                if (assetIndex !== -1) {
                  console.log(`REAL commodity price update: ${symbol} = $${data.price} (${data.change.toFixed(2)}%)`);
                  assets[assetIndex].price = data.price;
                  assets[assetIndex].change_24h = data.change;
                }
              }
            });
          }
          
          console.log(`Updated ${priceCache.size} assets with REAL market data (AllTick: ${allTickPrices.size}, Fallback: ${priceCache.size - allTickPrices.size})`);
          
        } catch (apiError) {
          console.error('CRITICAL: Failed to fetch fallback prices from APIs:', apiError);
        }
      }

      // Smart batching: Only send price updates if price changed significantly
      const significantPriceUpdates: PriceUpdate[] = [];
      
      assets.forEach(asset => {
        const lastSent = lastSentPrices.get(asset.symbol);
        const priceChangePercent = lastSent ? Math.abs((asset.price - lastSent.price) / lastSent.price * 100) : 100;
        
        // Send update if price changed by threshold or if it's been >30 seconds since last update
        if (!lastSent || priceChangePercent >= PRICE_CHANGE_THRESHOLD || (now - lastSent.timestamp) > 30000) {
          significantPriceUpdates.push({
            symbol: asset.symbol,
            price: asset.price,
            change_24h: asset.change_24h,
            timestamp: now
          });
          
          // Update last sent price
          lastSentPrices.set(asset.symbol, { price: asset.price, timestamp: now });
        }
      });

      // Only send WebSocket message if there are significant updates
      if (significantPriceUpdates.length > 0) {
        console.log(`Sending ${significantPriceUpdates.length} significant price updates (threshold: ${PRICE_CHANGE_THRESHOLD}%)`);
        socket.send(JSON.stringify({
          type: 'price_update',
          data: significantPriceUpdates
        }));
      } else {
        console.log('No significant price changes - skipping WebSocket message to reduce traffic');
      }

      // Update database only when we have significant fresh data (every 5 seconds max)
      if ((now - lastApiCall < 2000) && priceCache.size > 0 && significantPriceUpdates.length > 0) {
        const updatesWithFreshData = significantPriceUpdates.filter(update => {
          const cached = priceCache.get(update.symbol);
          return cached && (now - cached.timestamp) < API_CACHE_DURATION;
        });
        
        if (updatesWithFreshData.length > 0) {
          console.log(`Updating database with REAL market data for ${updatesWithFreshData.length} assets`);
          await updateDatabasePrices(updatesWithFreshData);
        }
      }

    } catch (error) {
      console.error('Error in sendPriceUpdates:', error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to update market prices'
      }));
    }
  };

  // Update database with real prices
  const updateDatabasePrices = async (priceUpdates: PriceUpdate[]) => {
    try {
      for (const update of priceUpdates) {
        await supabase
          .from('assets')
          .update({
            price: update.price,
            change_24h: update.change_24h,
            updated_at: new Date().toISOString()
          })
          .eq('symbol', update.symbol);
      }
      console.log(`Updated ${priceUpdates.length} assets in database with REAL prices`);
    } catch (error) {
      console.error('Error updating database prices:', error);
    }
  };

  socket.onclose = () => {
    console.log("🔌 WebSocket connection closed - cleaning up intervals");
    isConnected = false;
    if (priceInterval) {
      clearInterval(priceInterval);
      priceInterval = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (clientHeartbeatInterval) {
      clearInterval(clientHeartbeatInterval);
      clientHeartbeatInterval = null;
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    isConnected = false;
    if (priceInterval) {
      clearInterval(priceInterval);
      priceInterval = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (clientHeartbeatInterval) {
      clearInterval(clientHeartbeatInterval);
      clientHeartbeatInterval = null;
    }
  };

  return response;
});