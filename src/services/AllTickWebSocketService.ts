import { toast } from '@/hooks/use-toast';

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

export class AllTickWebSocketService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private subscribers = new Set<(data: PriceUpdate) => void>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private seqId = 1;

  // Connection endpoints (using proper AllTick API paths)
  private endpoints = [
    'wss://quote.alltick.io/quote-b-ws-api',      // Forex, Crypto, Commodities 
    'wss://quote.alltick.io/quote-stock-b-ws-api' // Stocks, Indices
  ];
  private endpointIndex = 0;

  // Watchdog and heartbeat management
  private lastDataTs = 0;
  private watchdog: number | null = null;
  private heartbeatInterval: number | null = null;
  
  // Symbol mapping from internal to AllTick format - All 100 trading pairs
  private symbolMapping: { [key: string]: string } = {
    // FOREX (30 pairs) - .FX suffix
    'EURUSD': 'EURUSD.FX',
    'GBPUSD': 'GBPUSD.FX',
    'USDJPY': 'USDJPY.FX',
    'AUDUSD': 'AUDUSD.FX',
    'USDCAD': 'USDCAD.FX',
    'NZDUSD': 'NZDUSD.FX',
    'USDCHF': 'USDCHF.FX',
    'EURGBP': 'EURGBP.FX',
    'EURJPY': 'EURJPY.FX',
    'GBPJPY': 'GBPJPY.FX',
    'AUDCAD': 'AUDCAD.FX',
    'AUDCHF': 'AUDCHF.FX',
    'AUDJPY': 'AUDJPY.FX',
    'AUDNZD': 'AUDNZD.FX',
    'CADCHF': 'CADCHF.FX',
    'CADJPY': 'CADJPY.FX',
    'CHFJPY': 'CHFJPY.FX',
    'EURAUD': 'EURAUD.FX',
    'EURCAD': 'EURCAD.FX',
    'EURCHF': 'EURCHF.FX',
    'EURNZD': 'EURNZD.FX',
    'GBPAUD': 'GBPAUD.FX',
    'GBPCAD': 'GBPCAD.FX',
    'GBPCHF': 'GBPCHF.FX',
    'GBPNZD': 'GBPNZD.FX',
    'NZDCAD': 'NZDCAD.FX',
    'NZDCHF': 'NZDCHF.FX',
    'NZDJPY': 'NZDJPY.FX',
    'USDSEK': 'USDSEK.FX',
    'USDNOK': 'USDNOK.FX',

    // CRYPTO (20 pairs) - .CC suffix
    'BTCUSD': 'BTCUSD.CC',
    'ETHUSD': 'ETHUSD.CC',
    'ADAUSD': 'ADAUSD.CC',
    'BNBUSD': 'BNBUSD.CC',
    'DOTUSD': 'DOTUSD.CC',
    'LINKUSD': 'LINKUSD.CC',
    'LTCUSD': 'LTCUSD.CC',
    'MATICUSD': 'MATICUSD.CC',
    'SOLUSD': 'SOLUSD.CC',
    'XRPUSD': 'XRPUSD.CC',
    'AVAXUSD': 'AVAXUSD.CC',
    'ATOMUSD': 'ATOMUSD.CC',
    'UNIUSD': 'UNIUSD.CC',
    'ALGOUSD': 'ALGOUSD.CC',
    'APTUSD': 'APTUSD.CC',
    'NEARUSD': 'NEARUSD.CC',
    'FTMUSD': 'FTMUSD.CC',
    'ICPUSD': 'ICPUSD.CC',
    'VETUSD': 'VETUSD.CC',
    'TRXUSD': 'TRXUSD.CC',

    // COMMODITIES (13 pairs) - .CM suffix
    'XAUUSD': 'XAUUSD.CM',
    'XAGUSD': 'XAGUSD.CM',
    'XPDUSD': 'XPDUSD.CM',
    'XPTUSD': 'XPTUSD.CM',
    'WTIUSD': 'WTIUSD.CM',
    'BCOUSD': 'BCOUSD.CM',
    'NATGAS': 'NATGAS.CM',
    'COPPER': 'COPPER.CM',
    'COCOA': 'COCOA.CM',
    'COFFEE': 'COFFEE.CM',
    'SUGAR': 'SUGAR.CM',
    'COTTON': 'COTTON.CM',
    'WHEAT': 'WHEAT.CM',

    // STOCKS (25 pairs) - .US suffix
    'AAPL': 'AAPL.US',
    'AMD': 'AMD.US',
    'AMZN': 'AMZN.US',
    'GOOGL': 'GOOGL.US',
    'INTC': 'INTC.US',
    'META': 'META.US',
    'MSFT': 'MSFT.US',
    'NFLX': 'NFLX.US',
    'NVDA': 'NVDA.US',
    'TSLA': 'TSLA.US',
    'TSMC': 'TSMC.US',
    'V': 'V.US',
    'JPM': 'JPM.US',
    'WMT': 'WMT.US',
    'PG': 'PG.US',
    'JNJ': 'JNJ.US',
    'UNH': 'UNH.US',
    'HD': 'HD.US',
    'MA': 'MA.US',
    'BAC': 'BAC.US',
    'XOM': 'XOM.US',
    'LLY': 'LLY.US',
    'ABBV': 'ABBV.US',
    'KO': 'KO.US',
    'PEP': 'PEP.US',

    // INDICES (12 pairs) - .IDX suffix
    'AUS200': 'AUS200.IDX',
    'DJ30': 'DJ30.IDX',
    'FRA40': 'FRA40.IDX',
    'GER40': 'GER40.IDX',
    'JPN225': 'JPN225.IDX',
    'NAS100': 'NAS100.IDX',
    'SPX500': 'SPX500.IDX',
    'UK100': 'UK100.IDX',
    'US30': 'US30.IDX',
    'HK50': 'HK50.IDX',
    'CHINA50': 'CHINA50.IDX',
    'EUSTX50': 'EUSTX50.IDX'
  };

  private symbolList: string[];

  constructor() {
    console.log('🔥 ALLTICK SERVICE CONSTRUCTOR CALLED - SERVICE CREATED');
    
    this.symbolList = Object.keys(this.symbolMapping);
    console.log(`🚀 AllTick frontend service initialized with ALL ${this.symbolList.length} symbols across 5 categories`);
    console.log(`📊 Coverage: ${Object.values(this.symbolMapping).filter(s => s.endsWith('.FX')).length} Forex, ${Object.values(this.symbolMapping).filter(s => s.endsWith('.CC')).length} Crypto, ${Object.values(this.symbolMapping).filter(s => s.endsWith('.CM')).length} Commodities, ${Object.values(this.symbolMapping).filter(s => s.endsWith('.US')).length} Stocks, ${Object.values(this.symbolMapping).filter(s => s.endsWith('.IDX')).length} Indices`);
  }

  async connect(): Promise<boolean> {
    console.log('🔥 ALLTICK CONNECT METHOD CALLED - STARTING CONNECTION PROCESS');
    
    try {
      console.log('🔌 Connecting to AllTick WebSocket directly from frontend...');
      
      const apiKey = import.meta.env.VITE_ALLTICK_CLIENT_KEY;
      if (!apiKey || apiKey === 'your-c-app-key-here') {
        console.error('❌ AllTick client API key not found in environment variables');
        console.error('🔧 Please set VITE_ALLTICK_CLIENT_KEY in your .env file');
        return false;
      }

      console.log('🔐 AllTick client API key found, establishing direct connection...');
      
      // Direct connection to AllTick using proper endpoint and token param
      const url = `${this.endpoints[this.endpointIndex]}?token=${encodeURIComponent(apiKey.trim())}`;
      console.log(`🔗 Connecting to: ${url}`);
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        console.log(`✅ AllTick WebSocket connected - starting subscription and heartbeat...`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastDataTs = 0;
        this.subscribeToPriceUpdates();
        this.startHeartbeat();
        this.startWatchdog();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 AllTick WebSocket disconnected - Code: ${event.code}, Reason: ${event.reason}`);
        this.isConnected = false;
        this.stopHeartbeat();
        if (this.watchdog) { clearInterval(this.watchdog); this.watchdog = null; }
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
      // Flip endpoint each attempt to maximize compatibility
      this.endpointIndex = (this.endpointIndex + 1) % this.endpoints.length;
      setTimeout(() => this.connect(), delay);
    } else {
      console.log('❌ Max AllTick reconnect attempts reached - no price data available');
    }
  }

  private subscribeToPriceUpdates() {
    if (!this.isConnected || !this.ws) return;

    // Start with a smaller subset to avoid plan limits, then scale up
    const allSymbols = Object.values(this.symbolMapping);
    const symbolsToSubscribe = allSymbols.slice(0, 50); // Start with 50 symbols
    
    console.log(`🚀 Starting AllTick subscription with ${symbolsToSubscribe.length} symbols (from ${allSymbols.length} total)`);
    
    // Use CORRECT cmd_id: 22004 for Latest Trade Price subscription
    const subscriptionMessage = {
      cmd_id: 22004,  // ✅ Correct command for transaction quote subscription
      seq_id: this.seqId++,
      trace: `price_sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: {
        symbol_list: symbolsToSubscribe.map(code => ({ code }))  // ✅ Correct format: array of {code} objects
      }
    } as const;

    console.log('📡 Sending AllTick subscription (cmd_id: 22004):', JSON.stringify(subscriptionMessage, null, 2));
    this.ws.send(JSON.stringify(subscriptionMessage));

    console.log(`📡 ✅ Subscribed to ${symbolsToSubscribe.length} symbols using CORRECT protocol`);
  }

  // Start mandatory heartbeat (cmd_id: 22000 every 10 seconds)
  private startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing
    this.heartbeatInterval = window.setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        const heartbeat = {
          cmd_id: 22000,  // ✅ Correct heartbeat command
          seq_id: this.seqId++,
          trace: `heartbeat_${Date.now()}`,
          data: {}
        };
        this.ws.send(JSON.stringify(heartbeat));
        console.log('💓 Heartbeat sent (cmd_id: 22000)');
      }
    }, 10000); // Every 10 seconds as required
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Watchdog to ensure we start receiving real-time ticks
  private startWatchdog() {
    if (this.watchdog) {
      clearInterval(this.watchdog);
    }
    const openedAt = Date.now();
    this.watchdog = window.setInterval(() => {
      const since = Date.now() - (this.lastDataTs || openedAt);
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      if (since > 8000 && since < 15000) {
        console.log('🔁 No ticks received yet — re-sending subscription...');
        this.subscribeToPriceUpdates();
      }
      if (since >= 15000) {
        console.log('⚠️ No ticks after 15s — switching endpoint and reconnecting');
        this.endpointIndex = (this.endpointIndex + 1) % this.endpoints.length;
        this.disconnect();
        this.connect();
      }
    }, 5000);
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);
      
      // Log first 3 messages in full for debugging
      if (this.seqId <= 5) {
        console.log('🔍 Full AllTick message:', message);
      } else {
        console.log('📨 AllTick message:', { 
          cmd_id: message.cmd_id, 
          ret: message.ret, 
          msg: message.msg,
          has_data: !!message.data
        });
      }
      
      // Handle subscription confirmation (cmd_id: 22005)
      if (message.cmd_id === 22005) {
        if (message.ret === 200) {
          console.log('✅ AllTick subscription confirmed successfully');
        } else {
          console.error(`❌ Subscription error - ret: ${message.ret}, msg: ${message.msg}`);
        }
      }
      
      // Handle heartbeat response (cmd_id: 22001)  
      if (message.cmd_id === 22001) {
        console.log('💓 Heartbeat acknowledged');
      }
      
      // Handle incoming price data (cmd_id: 22998)
      if (message.cmd_id === 22998) {
        if (message.data) {
          console.log(`📊 Received price tick for: ${message.data.code}`);
          this.handlePriceUpdate(message.data);
        }
      }
    } catch (error) {
      console.error('❌ Error parsing AllTick message:', error, 'Raw:', data);
    }
  }

  private handlePriceUpdate(data: any) {
    // Handle single price update (cmd_id: 22998 format)
    const code = data?.code;
    const lastPx = data?.last_px ?? data?.price ?? data?.lastPrice;
    const changePx = data?.change_px ?? data?.change ?? 0;
    const bidPx = data?.bid_px ?? data?.bid;
    const askPx = data?.ask_px ?? data?.ask;

    if (code && typeof lastPx === 'number') {
      // Map AllTick symbol back to our internal symbol
      const originalSymbol = Object.keys(this.symbolMapping)
        .find(key => this.symbolMapping[key] === code) || code.split('.')[0];

      const priceData: PriceUpdate = {
        symbol: originalSymbol,
        price: lastPx,
        change_24h: changePx || 0,
        volume: data?.volume || 0,
        bid: bidPx || lastPx,
        ask: askPx || lastPx,
        spread: (askPx && bidPx) ? askPx - bidPx : 0,
        timestamp: Date.now(),
        source: 'AllTick-Live'
      };

      // Mark that we have live data
      this.lastDataTs = Date.now();

      // Notify all subscribers
      this.subscribers.forEach(callback => callback(priceData));
      
      console.log(`⚡ LIVE TICK: ${originalSymbol} = $${lastPx} (${changePx || 0}%)`);
    } else {
      console.log('ℹ️ Incomplete price data:', data);
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
    return Object.keys(this.symbolMapping).length;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
    if (this.watchdog) { clearInterval(this.watchdog); this.watchdog = null; }
    this.isConnected = false;
    this.subscribers.clear();
  }
}