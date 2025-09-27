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
  const PRICE_CHANGE_THRESHOLD = 0.00001; // True tick-by-tick sensitivity (0.00001%)
  
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
          console.error('❌ AllTick API key not found in environment variables');
          console.error('🔧 Please add ALLTICK_API_KEY as a Supabase secret');
          return false;
        }

        console.log('🔐 AllTick API key found, establishing connection...');
        
        // Correct AllTick WebSocket endpoint for forex/crypto/commodities
        this.ws = new WebSocket(`wss://quote.alltick.io/quote-b-ws-api?token=${encodeURIComponent(apiKey.trim())}`);
        
        this.ws.onopen = () => {
          console.log(`✅ AllTick WebSocket connected - subscribing immediately...`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          // Skip separate authentication - API key in URL should handle auth
          // Immediately subscribe to price updates with test symbols
          this.subscribeToPriceUpdatesOnly();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log(`🔌 AllTick WebSocket disconnected - Code: ${event.code}, Reason: ${event.reason}`);
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

    // Removed separate authentication - API key in WebSocket URL handles auth

    private subscribeToPriceUpdatesOnly() {
      if (!this.isConnected || !this.ws) return;

      // Start with a small test list of known-good symbols
      const testSymbols = ["BTCUSD.CC", "ETHUSD.CC", "EURUSD.FX", "XAUUSD.CM"];
      
      console.log(`🧪 Starting AllTick subscription with test symbols: ${testSymbols.join(', ')}`);
      
      // Subscribe to Latest Trade Price using cmd_id: 22001
      const subscriptionMessage = {
        cmd_id: 22001,
        seq_id: this.seqId++,
        trace: `price_sub_${Date.now()}`,
        data: {
          symbol_list: testSymbols.map(symbol => ({
            code: symbol
          }))
        }
      };

      console.log('📡 Sending AllTick subscription:', JSON.stringify(subscriptionMessage, null, 2));
      this.ws.send(JSON.stringify(subscriptionMessage));

      console.log(`📡 Subscribed to AllTick Latest Trade Prices (${testSymbols.length} test symbols)`);
    }

    private handleMessage(data: string) {
      try {
        const message = JSON.parse(data);
        console.log('📨 AllTick message received:', { 
          cmd_id: message.cmd_id, 
          ret_code: message.ret_code, 
          ret_msg: message.ret_msg,
          has_data: !!message.data
        });
        
        // AllTick uses cmd_id to identify message types
        if (message.cmd_id === 22001) {
          // Latest Trade Price subscription response or data
          if (message.ret_code === 0) {
            if (message.data && message.data.symbol_list) {
              // Price data received
              console.log(`📊 AllTick RT data: ${message.data.symbol_list.length} symbols`);
              this.handlePriceUpdate(message.data);
            } else {
              // Subscription confirmation
              console.log('✅ AllTick subscription confirmed successfully');
            }
          } else {
            console.error(`❌ AllTick error - ret_code: ${message.ret_code}, ret_msg: ${message.ret_msg}`);
            console.error('📄 Full message:', JSON.stringify(message, null, 2));
          }
        } else if (message.ret_code && message.ret_code !== 0) {
          console.error(`❌ AllTick error - cmd_id: ${message.cmd_id}, ret_code: ${message.ret_code}, ret_msg: ${message.ret_msg}`);
        } else {
          console.log(`📝 AllTick message cmd_id: ${message.cmd_id} (ignored)`);
        }
      } catch (error) {
        console.error('❌ Error parsing AllTick message:', error);
        console.error('📄 Raw message data:', data);
      }
    }

    private handlePriceUpdate(data: any) {
      if (!data || !data.symbol_list) {
        console.log('⚠️ No symbol_list in AllTick price data');
        return;
      }

      let updateCount = 0;
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
            source: 'AllTick-RT'
          };

          // Update cache and notify subscribers
          priceCache.set(originalSymbol, priceData);
          this.subscribers.forEach(callback => callback(priceData));
          updateCount++;
          
          console.log(`🚀 AllTick RT: ${originalSymbol} = $${update.last_px} (${update.change_px || 0}%)`);
        }
      }
      
      console.log(`📊 Processed ${updateCount} AllTick price updates`);
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

  // Binance WebSocket for crypto price fallback
  class BinanceWebSocket {
    private ws: WebSocket | null = null;
    private isConnected = false;
    private subscribers = new Set<(data: PriceUpdate) => void>();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private cryptoSymbols: string[] = [];
    
    // Major crypto symbols supported by Binance
    private binanceSymbolMapping: Record<string, string> = {
      'BTCUSD': 'BTCUSDT', 'ETHUSD': 'ETHUSDT', 'BNBUSD': 'BNBUSDT',
      'ADAUSD': 'ADAUSDT', 'XRPUSD': 'XRPUSDT', 'SOLUSD': 'SOLUSDT',
      'DOTUSD': 'DOTUSDT', 'LINKUSD': 'LINKUSDT', 'LTCUSD': 'LTCUSDT',
      'MATICUSD': 'MATICUSDT', 'AVAXUSD': 'AVAXUSDT', 'UNIUSD': 'UNIUSDT'
    };

    constructor() {
      this.cryptoSymbols = Object.keys(this.binanceSymbolMapping);
      console.log(`🟡 Binance WebSocket initialized with ${this.cryptoSymbols.length} crypto symbols`);
    }

    async connect() {
      try {
        console.log('🟡 Connecting to Binance WebSocket for crypto fallback...');
        
        // Create stream names for all crypto pairs
        const streams = Object.values(this.binanceSymbolMapping)
          .map(symbol => `${symbol.toLowerCase()}@ticker`)
          .join('/');
        
        this.ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
        
        this.ws.onopen = () => {
          console.log(`✅ Binance WebSocket connected - streaming ${this.cryptoSymbols.length} crypto pairs`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log(`🟡 Binance WebSocket disconnected - Code: ${event.code}`);
          this.isConnected = false;
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('❌ Binance WebSocket error:', error);
          this.isConnected = false;
        };

        return true;
      } catch (error) {
        console.error('Failed to connect to Binance WebSocket:', error);
        this.scheduleReconnect();
        return false;
      }
    }

    private scheduleReconnect() {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
        console.log(`🔄 Reconnecting to Binance in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
      }
    }

    private handleMessage(data: string) {
      try {
        const msg = JSON.parse(data);
        // Combined stream wraps payload as { stream, data }
        const ticker = msg.data ?? msg;
        
        if (ticker.s && ticker.c) {
          // Find our symbol from Binance symbol
          const ourSymbol = Object.keys(this.binanceSymbolMapping)
            .find(key => this.binanceSymbolMapping[key] === ticker.s);
          
          if (ourSymbol) {
            const priceData: PriceUpdate = {
              symbol: ourSymbol,
              price: parseFloat(ticker.c), // Current price
              change_24h: parseFloat(ticker.P), // 24h price change percent
              volume: parseFloat(ticker.v), // 24h volume
              bid: ticker.b ? parseFloat(ticker.b) : undefined, // Best bid price
              ask: ticker.a ? parseFloat(ticker.a) : undefined, // Best ask price
              spread: ticker.a && ticker.b ? (parseFloat(ticker.a) - parseFloat(ticker.b)) : undefined,
              timestamp: Date.now(),
              source: 'Binance-RT'
            };

            // Update cache and notify subscribers
            priceCache.set(ourSymbol, priceData);
            this.subscribers.forEach(callback => callback(priceData));
            
            console.log(`🟡 Binance RT: ${ourSymbol} = $${ticker.c} (${ticker.P}%)`);
          }
        }
      } catch (error) {
        console.error('❌ Error parsing Binance message:', error);
      }
    }

    subscribeToPrices(callback: (data: PriceUpdate) => void) {
      this.subscribers.add(callback);
      return () => this.subscribers.delete(callback);
    }

    isConnectedStatus(): boolean {
      return this.isConnected;
    }

    getSymbolCount(): number {
      return this.cryptoSymbols.length;
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

  // Initialize WebSocket connections
  const allTickWS = new AllTickWebSocket();
  const binanceWS = new BinanceWebSocket();
  let allTickConnected = false;
  let binanceConnected = false;
  let allTickSubscribed = false;
  let binanceSubscribed = false;

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

  // Ultra-fast REST fallback for crypto via Binance (used when WS is unavailable)
  const getCryptoPricesBinanceRest = async (
    symbols: string[]
  ): Promise<Map<string, { price: number; change: number }>> => {
    const map = new Map<string, { price: number; change: number }>();
    try {
      // Map our USD symbols to Binance USDT symbols
      const binanceSymbols = symbols
        .map((s) => (s.endsWith('USD') ? s.replace('USD', 'USDT') : ''))
        .filter((s) => !!s);
      if (binanceSymbols.length === 0) return map;

      const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(binanceSymbols))}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        for (const item of data) {
          const ourSymbol = typeof item.symbol === 'string' ? item.symbol.replace('USDT', 'USD') : undefined;
          const lastPrice = parseFloat(item.lastPrice ?? item.c ?? '0');
          const changePct = parseFloat(item.priceChangePercent ?? item.P ?? '0');
          if (ourSymbol && !Number.isNaN(lastPrice)) {
            map.set(ourSymbol, { price: lastPrice, change: changePct });
            console.log(`Binance REST: ${ourSymbol} = $${lastPrice} (${changePct}%)`);
          }
        }
      } else {
        console.error('Binance REST response not ok:', resp.status, await resp.text());
      }
    } catch (error) {
      console.error('Binance REST error:', error);
    }
    return map;
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
      
      // Initialize AllTick WebSocket connection if not connected (don't trust return value; rely on status)
      if (!allTickWS.isConnectedStatus() && !allTickConnected) {
        console.log('🚀 Initializing AllTick WebSocket connection...');
        allTickWS.connect();
      }
      // Refresh status and subscribe once
      allTickConnected = allTickWS.isConnectedStatus();
      if (allTickConnected && !allTickSubscribed) {
        // Subscribe to real-time price updates
        allTickWS.subscribeToPrices((priceData: PriceUpdate) => {
          const assetIndex = assets.findIndex(a => a.symbol === priceData.symbol);
          if (assetIndex !== -1) {
            assets[assetIndex].price = priceData.price;
            assets[assetIndex].change_24h = priceData.change_24h;
          }
          priceCache.set(priceData.symbol, priceData);
        });
        allTickSubscribed = true;
        console.log(`🚀 AllTick connected - price updates for ${allTickWS.getSymbolCount()} symbols`);
      }

      // Initialize Binance WebSocket as fallback if AllTick is not available
      if (!allTickConnected && !binanceWS.isConnectedStatus() && !binanceConnected) {
        console.log('🟡 Initializing Binance WebSocket fallback...');
        binanceWS.connect();
      }
      // Refresh status and subscribe once
      binanceConnected = binanceWS.isConnectedStatus();
      if (!allTickConnected && binanceConnected && !binanceSubscribed) {
        // Subscribe to Binance real-time crypto updates
        binanceWS.subscribeToPrices((priceData: PriceUpdate) => {
          const assetIndex = assets.findIndex(a => a.symbol === priceData.symbol);
          if (assetIndex !== -1) {
            assets[assetIndex].price = priceData.price;
            assets[assetIndex].change_24h = priceData.change_24h;
          }
          priceCache.set(priceData.symbol, priceData);
        });
        binanceSubscribed = true;
        console.log(`🟡 Binance connected - crypto fallback for ${binanceWS.getSymbolCount()} symbols`);
      }

      // Smart batching: Only send updates when prices change significantly
      const significantPriceUpdates: PriceUpdate[] = [];
      
      // Multi-tier fallback: AllTick -> Binance -> Yahoo Finance
      if (priceCache.size === 0 || (!allTickWS.isConnectedStatus() && !binanceWS.isConnectedStatus())) {
        try {
          const assetSymbols = assets.map(a => a.symbol);
          // First, try ultra-fast Binance REST for crypto if WS is down
          const [binanceRestMap, forexMap, commodityMap] = await Promise.all([
            getCryptoPricesBinanceRest(assetSymbols),
            getForexRates(),
            getCommodityPrices()
          ]);

          const mergeMap = (map: Map<string, { price: number; change: number }>, source: string = 'fallback') => {
            map.forEach((val, sym) => {
              // Only use fallback if we don't have real-time data
              if (!priceCache.has(sym)) {
                const priceData: PriceUpdate = {
                  symbol: sym,
                  price: val.price,
                  change_24h: val.change,
                  timestamp: Date.now(),
                  source
                };
                // Update assets for immediate initial publish
                const idx = assets.findIndex(a => a.symbol === sym);
                if (idx !== -1) {
                  assets[idx].price = val.price;
                  assets[idx].change_24h = val.change;
                }
                priceCache.set(sym, priceData);
              }
            });
          };

          // Merge Binance REST first, then Yahoo for anything missing
          if (binanceRestMap.size > 0) {
            mergeMap(binanceRestMap, 'Binance-REST');
          }

          // Fill any remaining symbols via Yahoo fallback
          const yahooCryptoMap = await getCryptoPrices(assetSymbols);
          mergeMap(yahooCryptoMap, 'Yahoo-Crypto');
          mergeMap(forexMap, 'Yahoo-Forex');
          mergeMap(commodityMap, 'Yahoo-Commodity');
        } catch (e) {
          console.error('Fallback price population failed:', e);
        }
      }
      
      // Get current prices from cache (updated by WebSocket or fallbacks)
      priceCache.forEach((priceData, symbol) => {
        const lastSent = lastSentPrices.get(symbol);
        const priceChangePercent = lastSent ? Math.abs((priceData.price - lastSent.price) / lastSent.price * 100) : 100;
        
        // Lower threshold for real-time data, higher for fallbacks
        const threshold = (priceData.source?.includes('RT') || priceData.source === 'AllTick-RT') 
          ? PRICE_CHANGE_THRESHOLD 
          : PRICE_CHANGE_THRESHOLD * 10;
        
        // Send update if price changed by threshold, it's real-time data, or >3 seconds since last update
        if (!lastSent || priceChangePercent >= threshold || priceData.source?.includes('RT') || (now - lastSent.timestamp) > 3000) {
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
        // Determine primary source dynamically from payload if WS not connected
        let primarySource = allTickWS.isConnectedStatus() ? 'AllTick' :
                            binanceWS.isConnectedStatus() ? 'Binance-WS' : 'Fallback';
        if (primarySource === 'Fallback') {
          const hasBinanceRest = significantPriceUpdates.some(u => u.source === 'Binance-REST');
          if (hasBinanceRest) primarySource = 'Binance-REST';
        }

        console.log(`📡 Sending ${significantPriceUpdates.length} tick-by-tick updates (threshold: ${PRICE_CHANGE_THRESHOLD}%) from ${primarySource}`);

        socket.send(JSON.stringify({
          type: 'price_update',
          data: significantPriceUpdates,
          metadata: {
            source: primarySource,
            alltick_connected: allTickWS.isConnectedStatus(),
            binance_connected: binanceWS.isConnectedStatus(),
            total_symbols: allTickWS.getSymbolCount() + binanceWS.getSymbolCount(),
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
    console.log("🔌 WebSocket connection closed - cleaning up connections");
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
    // Disconnect all WebSocket connections
    if (allTickConnected) {
      allTickWS.disconnect();
      allTickConnected = false;
    }
    if (binanceConnected) {
      binanceWS.disconnect();
      binanceConnected = false;
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