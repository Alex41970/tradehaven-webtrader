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
  volume?: number;
  bid?: number;
  ask?: number;
  spread?: number;
  source?: string;
}

// Removed CandlestickData and OrderBookData interfaces - only using price updates

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

  // Enhanced cache for real-time price data only
  let priceCache = new Map<string, PriceUpdate>();
  const PRICE_CHANGE_THRESHOLD = 0.001; // Ultra-sensitive for high-frequency trading
  
  // AllTick WebSocket for real-time tick-by-tick data
  class AllTickWebSocket {
    private ws: WebSocket | null = null;
    private isConnected = false;
    private subscribers = new Set<(data: PriceUpdate) => void>();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private seqId = 1;
    private symbolList: string[] = [];
    
    // AllTick symbol mapping with proper suffixes
    private symbolMapping: Record<string, string> = {
      // Major Cryptocurrencies (.CC suffix)
      'BTCUSD': 'BTCUSD.CC', 'ETHUSD': 'ETHUSD.CC', 'SOLUSD': 'SOLUSD.CC', 'ADAUSD': 'ADAUSD.CC',
      'DOGEUSD': 'DOGEUSD.CC', 'MATICUSD': 'MATICUSD.CC', 'LINKUSD': 'LINKUSD.CC', 'AVAXUSD': 'AVAXUSD.CC',
      'DOTUSD': 'DOTUSD.CC', 'UNIUSD': 'UNIUSD.CC', 'LTCUSD': 'LTCUSD.CC', 'BCHUSD': 'BCHUSD.CC',
      'XLMUSD': 'XLMUSD.CC', 'FILUSD': 'FILUSD.CC', 'APEUSD': 'APEUSD.CC', 'SANDUSD': 'SANDUSD.CC',
      'MANAUSD': 'MANAUSD.CC', 'AXSUSD': 'AXSUSD.CC', 'CHZUSD': 'CHZUSD.CC', 'FLOWUSD': 'FLOWUSD.CC',
      'BNBUSD': 'BNBUSD.CC', 'XRPUSD': 'XRPUSD.CC', 'TRXUSD': 'TRXUSD.CC', 'ATOMUSD': 'ATOMUSD.CC',
      'ALGOUSD': 'ALGOUSD.CC', 'VETUSD': 'VETUSD.CC', 'EOSUSD': 'EOSUSD.CC', 'IOTAUSD': 'IOTAUSD.CC',
      'XTZUSD': 'XTZUSD.CC', 'COMPUSD': 'COMPUSD.CC',
      
      // Major Forex Pairs (.FX suffix)
      'EURUSD': 'EURUSD.FX', 'GBPUSD': 'GBPUSD.FX', 'USDJPY': 'USDJPY.FX', 'AUDUSD': 'AUDUSD.FX',
      'USDCAD': 'USDCAD.FX', 'USDCHF': 'USDCHF.FX', 'NZDUSD': 'NZDUSD.FX', 'EURGBP': 'EURGBP.FX',
      'EURJPY': 'EURJPY.FX', 'GBPJPY': 'GBPJPY.FX', 'AUDJPY': 'AUDJPY.FX', 'CADJPY': 'CADJPY.FX',
      'CHFJPY': 'CHFJPY.FX', 'EURCHF': 'EURCHF.FX', 'GBPCHF': 'GBPCHF.FX', 'AUDCHF': 'AUDCHF.FX',
      'EURAUD': 'EURAUD.FX', 'EURNZD': 'EURNZD.FX', 'GBPAUD': 'GBPAUD.FX', 'GBPNZD': 'GBPNZD.FX',
      'AUDNZD': 'AUDNZD.FX', 'USDSGD': 'USDSGD.FX', 'USDHKD': 'USDHKD.FX', 'USDNOK': 'USDNOK.FX',
      'USDSEK': 'USDSEK.FX',
      
      // Precious Metals & Commodities (.CM suffix)
      'XAUUSD': 'XAUUSD.CM', 'XAGUSD': 'XAGUSD.CM', 'XPTUSD': 'XPTUSD.CM', 'XPDUSD': 'XPDUSD.CM',
      'USOIL': 'USOIL.CM', 'UKBRENT': 'UKBRENT.CM', 'NATGAS': 'NATGAS.CM', 'COPPER': 'COPPER.CM', 
      'WHEAT': 'WHEAT.CM', 'CORN': 'CORN.CM', 'SOYBEANS': 'SOYBEANS.CM', 'COFFEE': 'COFFEE.CM', 
      'SUGAR': 'SUGAR.CM', 'COTTON': 'COTTON.CM', 'COCOA': 'COCOA.CM', 'OATS': 'OATS.CM', 
      'RICE': 'RICE.CM', 'LUMBER': 'LUMBER.CM', 'HEATING_OIL': 'HEATING_OIL.CM', 'GASOLINE': 'GASOLINE.CM',
      
      // Major US Stocks (.US suffix)
      'AAPL': 'AAPL.US', 'MSFT': 'MSFT.US', 'GOOGL': 'GOOGL.US', 'AMZN': 'AMZN.US', 'TSLA': 'TSLA.US',
      'META': 'META.US', 'NFLX': 'NFLX.US', 'NVDA': 'NVDA.US', 'AMD': 'AMD.US', 'INTC': 'INTC.US',
      'SPY': 'SPY.US', 'QQQ': 'QQQ.US', 'DIA': 'DIA.US', 'IWM': 'IWM.US', 'VTI': 'VTI.US'
    };

    constructor() {
      this.symbolList = Object.keys(this.symbolMapping);
      console.log(`🚀 AllTick WebSocket initialized with ${this.symbolList.length} symbols`);
    }

    async connect() {
      try {
        console.log('🔌 Connecting to AllTick WebSocket for tick-by-tick data...');
        
        const apiKey = Deno.env.get('ALLTICK_API_KEY');
        if (!apiKey) {
          console.error('❌ AllTick API key not found');
          return false;
        }

        // Correct AllTick WebSocket endpoint from documentation
        this.ws = new WebSocket(`wss://quote.alltick.io/quote-stock-b-ws-api?t=${encodeURIComponent(apiKey.trim())}`);
        
        this.ws.onopen = () => {
          console.log(`✅ AllTick WebSocket connected - subscribing to ${this.symbolList.length} symbols for price updates only`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.subscribeToPriceUpdatesOnly();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          console.log('🔌 AllTick WebSocket disconnected');
          this.isConnected = false;
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('❌ AllTick WebSocket error:', error);
          this.isConnected = false;
        };

        return true;
      } catch (error) {
        console.error('Failed to connect to AllTick WebSocket:', error);
        this.scheduleReconnect();
        return false;
      }
    }

    private scheduleReconnect() {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`🔄 Reconnecting to AllTick in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
      }
    }

    private subscribeToPriceUpdatesOnly() {
      if (!this.isConnected || !this.ws) return;

      const allTickSymbols = this.symbolList.map(symbol => this.symbolMapping[symbol]);
      
      // Subscribe only to real-time tick data using AllTick's JSON protocol
      // cmd_id: 22002 for real-time tick data
      this.ws.send(JSON.stringify({
        cmd_id: 22002,
        seq_id: this.seqId++,
        trace: `tick_${Date.now()}`,
        data: {
          symbol_list: allTickSymbols.map(symbol => ({
            code: symbol,
            depth_level: 1 // Minimal depth needed for price only
          }))
        }
      }));

      console.log(`📡 Subscribed to AllTick price updates only (${allTickSymbols.length} symbols)`);
    }

    private handleMessage(data: string) {
      try {
        const message = JSON.parse(data);
        
        // AllTick uses cmd_id to identify message types
        if (message.cmd_id === 22002) {
          // Real-time tick data response - only price updates
          this.handlePriceUpdate(message.data);
        } else if (message.cmd_id === 22001) {
          // Authentication response
          console.log('AllTick authentication response:', message);
        } else {
          // Ignore other message types (candlestick, order book, etc.)
          console.log('Ignoring AllTick message type:', message.cmd_id);
        }
      } catch (error) {
        console.error('Error parsing AllTick message:', error);
      }
    }

    private handlePriceUpdate(data: any) {
      if (!data || !data.symbol_list) return;

      for (const update of data.symbol_list) {
        if (update.code && typeof update.last_px === 'number') {
          // Map AllTick symbol back to our internal symbol
          const originalSymbol = Object.keys(this.symbolMapping)
            .find(key => this.symbolMapping[key] === update.code) || update.code.split('.')[0];

          const priceData: PriceUpdate = {
            symbol: originalSymbol,
            price: update.last_px,
            change_24h: update.change_px || 0,
            volume: update.volume || 0,
            bid: update.bid_px || update.last_px,
            ask: update.ask_px || update.last_px,
            spread: (update.ask_px && update.bid_px) ? update.ask_px - update.bid_px : 0,
            timestamp: Date.now(),
            source: 'AllTick-WS'
          };

          // Update cache and notify subscribers
          priceCache.set(originalSymbol, priceData);
          this.subscribers.forEach(callback => callback(priceData));
        }
      }
    }

    // Removed candlestick and order book handlers - price updates only

    subscribeToPrices(callback: (data: PriceUpdate) => void) {
      this.subscribers.add(callback);
      return () => this.subscribers.delete(callback);
    }

    isConnectedStatus(): boolean {
      return this.isConnected;
    }

    getSymbolCount(): number {
      return this.symbolList.length;
    }

    disconnect() {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.isConnected = false;
      this.subscribers.clear();
    }
  }

  // Initialize AllTick WebSocket
  const allTickWS = new AllTickWebSocket();
  let allTickConnected = false;

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
  let lastApiCall = 0;

  const sendPriceUpdates = async () => {
    try {
      const now = Date.now();
      
      // Initialize AllTick WebSocket connection if not connected
      if (!allTickConnected) {
        console.log('🚀 Initializing AllTick WebSocket connection...');
        allTickConnected = await allTickWS.connect();
        
        if (allTickConnected) {
          // Subscribe to real-time price updates
          allTickWS.subscribeToPrices((priceData: PriceUpdate) => {
            // Update asset price in real-time
            const assetIndex = assets.findIndex(a => a.symbol === priceData.symbol);
            if (assetIndex !== -1) {
              assets[assetIndex].price = priceData.price;
              assets[assetIndex].change_24h = priceData.change_24h;
              
              console.log(`⚡ Real-time tick: ${priceData.symbol} = $${priceData.price} (${priceData.change_24h.toFixed(2)}%)`);
            }
          });

          // Only subscribe to price updates for optimal performance
          console.log(`🚀 AllTick connected - price updates only for ${allTickWS.getSymbolCount()} symbols`);
        }
      }

      // Smart batching: Only send updates when prices change significantly
      const significantPriceUpdates: PriceUpdate[] = [];
      
      // If AllTick cache is empty or WS not connected, populate from fallbacks
      if (priceCache.size === 0 || !allTickWS.isConnectedStatus()) {
        try {
          const assetSymbols = assets.map(a => a.symbol);
          const [cryptoMap, forexMap, commodityMap] = await Promise.all([
            getCryptoPrices(assetSymbols),
            getForexRates(),
            getCommodityPrices()
          ]);

          const mergeMap = (map: Map<string, { price: number; change: number }>) => {
            map.forEach((val, sym) => {
              const priceData: PriceUpdate = {
                symbol: sym,
                price: val.price,
                change_24h: val.change,
                timestamp: Date.now(),
                source: 'fallback'
              };
              // Update assets for immediate initial publish
              const idx = assets.findIndex(a => a.symbol === sym);
              if (idx !== -1) {
                assets[idx].price = val.price;
                assets[idx].change_24h = val.change;
              }
              priceCache.set(sym, priceData);
            });
          };

          mergeMap(cryptoMap);
          mergeMap(forexMap);
          mergeMap(commodityMap);
        } catch (e) {
          console.error('Fallback price population failed:', e);
        }
      }
      
      // Get current prices from cache (updated by WebSocket)
      priceCache.forEach((priceData, symbol) => {
        const lastSent = lastSentPrices.get(symbol);
        const priceChangePercent = lastSent ? Math.abs((priceData.price - lastSent.price) / lastSent.price * 100) : 100;
        
        // Send update if price changed by threshold or it's been >5 seconds since last update
        if (!lastSent || priceChangePercent >= PRICE_CHANGE_THRESHOLD || (now - lastSent.timestamp) > 5000) {
          significantPriceUpdates.push({
            symbol: priceData.symbol,
            price: priceData.price,
            change_24h: priceData.change_24h,
            volume: priceData.volume,
            bid: priceData.bid,
            ask: priceData.ask,
            spread: priceData.spread,
            timestamp: now,
            source: priceData.source
          });
          
          // Update last sent price
          lastSentPrices.set(symbol, { price: priceData.price, timestamp: now });
        }
      });

      // Only send WebSocket message if there are significant updates
      if (significantPriceUpdates.length > 0) {
        console.log(`📡 Sending ${significantPriceUpdates.length} tick-by-tick updates (threshold: ${PRICE_CHANGE_THRESHOLD}%)`);
        
        socket.send(JSON.stringify({
          type: 'price_update',
          data: significantPriceUpdates,
          metadata: {
            source: 'AllTick-WebSocket',
            total_symbols: allTickWS.getSymbolCount(),
            connected: allTickWS.isConnectedStatus(),
            timestamp: now
          }
        }));
      } else {
        console.log('📊 No significant price changes - optimizing bandwidth');
      }

      // Update database less frequently to reduce load (every 5 seconds max)
      if (significantPriceUpdates.length > 0 && (now - lastApiCall) > 5000) {
        lastApiCall = now;
        console.log(`💾 Updating database with ${significantPriceUpdates.length} price changes`);
        await updateDatabasePrices(significantPriceUpdates);
      }

    } catch (error) {
      console.error('Error in sendPriceUpdates:', error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to update market prices',
        details: error instanceof Error ? error.message : String(error)
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
    console.log("🔌 WebSocket connection closed - cleaning up AllTick connection");
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
    // Disconnect AllTick WebSocket
    if (allTickConnected) {
      allTickWS.disconnect();
      allTickConnected = false;
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