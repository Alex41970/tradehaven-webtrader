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
  let assets: any[] = [];

  socket.onopen = async () => {
    console.log("WebSocket connection opened");
    isConnected = true;
    
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
      
      // Start real-time price updates (every 2 seconds for faster P&L updates)
      priceInterval = setInterval(() => {
        if (isConnected) {
          sendPriceUpdates();
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error fetching assets:', error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to fetch initial data'
      }));
    }
  };

  // Cache for API responses to avoid hitting rate limits
  let priceCache = new Map<string, { price: number; change: number; timestamp: number }>();
  let lastApiCall = 0;
  const API_CACHE_DURATION = 15000; // 15 seconds cache for real data
  
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
  
  // Helper function to get crypto prices from Yahoo Finance (no rate limits)
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
      console.log(`Fetching REAL crypto prices for: ${cryptoSymbols.join(', ')}`);
      
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
          console.error(`Yahoo Finance crypto error for ${symbol}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Yahoo Finance crypto API error:', error);
      throw error;
    }
    
    return cryptoMap;
  };

  // Helper function to get real forex rates with 24h change from Yahoo Finance
  const getForexRates = async (): Promise<Map<string, { price: number; change: number }>> => {
    const ratesMap = new Map();
    
    try {
      console.log('Fetching REAL forex rates from Yahoo Finance...');
      
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
          console.error(`Yahoo Finance forex error for ${symbol}:`, error.message);
        }
      }
      
      console.log(`Yahoo Finance forex rates fetched: ${Array.from(ratesMap.keys()).join(', ')}`);
    } catch (error) {
      console.error('Yahoo Finance forex API error:', error);
      throw error;
    }
    
    return ratesMap;
  };

  // Helper function to get REAL commodity prices from multiple sources
  const getCommodityPrices = async (): Promise<Map<string, { price: number; change: number }>> => {
    const commodityMap = new Map();
    
    console.log('Fetching REAL commodity prices from multiple sources...');
    
    // Try multiple data sources for commodity prices
    await Promise.allSettled([
      fetchFromYahooFinance(commodityMap),
      fetchFromAlphaVantage(commodityMap),
      fetchFromFinnhub(commodityMap)
    ]);
    
    // Validate we have real prices
    const requiredCommodities = ['WTIUSD', 'BCOUSD', 'NATGAS', 'XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD'];
    const missingData = requiredCommodities.filter(symbol => !commodityMap.has(symbol));
    
    if (missingData.length > 0) {
      console.error(`Failed to fetch real prices for: ${missingData.join(', ')}`);
      console.error('NO FALLBACK - REAL PRICES REQUIRED');
      throw new Error(`Unable to fetch real commodity prices for: ${missingData.join(', ')}`);
    }
    
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
          console.error(`Yahoo Finance error for ${ourSymbol}:`, error.message);
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
          console.error(`Alpha Vantage error for ${symbol}:`, error.message);
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
          console.error(`Finnhub error for ${ourSymbol}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Finnhub API error:', error);
    }
  };

  const sendPriceUpdates = async () => {
    try {
      const now = Date.now();
      
      // Fetch fresh REAL prices from APIs every 15 seconds
      if (now - lastApiCall > API_CACHE_DURATION) {
        console.log('Refreshing REAL prices from APIs...');
        lastApiCall = now;
        
        const cryptoSymbols = assets.filter(a => a.category === 'crypto').map(a => a.symbol);
        const forexSymbols = assets.filter(a => a.category === 'forex').map(a => a.symbol);
        const commoditySymbols = assets.filter(a => a.category === 'commodities').map(a => a.symbol);
        
        try {
          // Fetch real prices from all sources
          const results = await Promise.allSettled([
            cryptoSymbols.length > 0 ? getCryptoPrices(cryptoSymbols) : Promise.resolve(new Map()),
            forexSymbols.length > 0 ? getForexRates() : Promise.resolve(new Map()),
            commoditySymbols.length > 0 ? getCommodityPrices() : Promise.resolve(new Map())
          ]);
          
          const [cryptoResult, forexResult, commodityResult] = results;
          
          // Process crypto prices
          if (cryptoResult.status === 'fulfilled') {
            const cryptoPrices = cryptoResult.value;
            cryptoPrices.forEach((data, symbol) => {
              priceCache.set(symbol, { ...data, timestamp: now });
              const assetIndex = assets.findIndex(a => a.symbol === symbol);
              if (assetIndex !== -1) {
                assets[assetIndex].price = data.price;
                assets[assetIndex].change_24h = data.change;
              }
            });
          } else {
            console.error('Failed to fetch crypto prices:', cryptoResult.reason);
          }
          
          // Process forex rates
          if (forexResult.status === 'fulfilled') {
            const forexRates = forexResult.value;
            forexRates.forEach((data, symbol) => {
              priceCache.set(symbol, { price: data.price, change: data.change, timestamp: now });
              const assetIndex = assets.findIndex(a => a.symbol === symbol);
              if (assetIndex !== -1) {
                console.log(`REAL forex rate update: ${symbol} = ${data.price} (${data.change.toFixed(2)}%)`);
                assets[assetIndex].price = data.price;
                assets[assetIndex].change_24h = data.change;
              }
            });
          } else {
            console.error('Failed to fetch forex rates:', forexResult.reason);
          }
          
          // Process commodity prices
          if (commodityResult.status === 'fulfilled') {
            const commodityPrices = commodityResult.value;
            commodityPrices.forEach((data, symbol) => {
              priceCache.set(symbol, { ...data, timestamp: now });
              const assetIndex = assets.findIndex(a => a.symbol === symbol);
              if (assetIndex !== -1) {
                console.log(`REAL commodity price update: ${symbol} = $${data.price} (${data.change.toFixed(2)}%)`);
                assets[assetIndex].price = data.price;
                assets[assetIndex].change_24h = data.change;
              }
            });
          } else {
            console.error('Failed to fetch commodity prices:', commodityResult.reason);
          }
          
        } catch (apiError) {
          console.error('CRITICAL: Failed to fetch real prices from APIs:', apiError);
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Unable to fetch real market data. Please check your internet connection.'
          }));
          return;
        }
      }

      // Create price updates using only real data
      const priceUpdates: PriceUpdate[] = assets.map(asset => {
        return {
          symbol: asset.symbol,
          price: asset.price,
          change_24h: asset.change_24h,
          timestamp: now
        };
      });

      socket.send(JSON.stringify({
        type: 'price_update',
        data: priceUpdates
      }));

      // Update database with REAL prices only when we have fresh data
      if ((now - lastApiCall < 5000) && priceCache.size > 0) {
        const updatesWithFreshData = priceUpdates.filter(update => {
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
    console.log("WebSocket connection closed");
    isConnected = false;
    if (priceInterval) {
      clearInterval(priceInterval);
      priceInterval = null;
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    isConnected = false;
    if (priceInterval) {
      clearInterval(priceInterval);
      priceInterval = null;
    }
  };

  return response;
});