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
  
  // Symbol mapping from internal to AllTick format
  private symbolMapping: { [key: string]: string } = {
    'BTCUSD': 'BTCUSD.CC',
    'ETHUSD': 'ETHUSD.CC', 
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
    'XAUUSD': 'XAUUSD.CM',
    'XAGUSD': 'XAGUSD.CM',
    'USOIL': 'USOIL.CM',
    'UKOIL': 'UKOIL.CM'
  };

  private symbolList: string[];

  constructor() {
    this.symbolList = Object.keys(this.symbolMapping);
    console.log(`🚀 AllTick frontend service initialized with ${this.symbolList.length} symbols`);
  }

  async connect(): Promise<boolean> {
    try {
      console.log('🔌 Connecting to AllTick WebSocket directly from frontend...');
      
      const apiKey = import.meta.env.VITE_ALLTICK_CLIENT_KEY;
      if (!apiKey || apiKey === 'your-c-app-key-here') {
        console.error('❌ AllTick client API key not found in environment variables');
        console.error('🔧 Please set VITE_ALLTICK_CLIENT_KEY in your .env file');
        return false;
      }

      console.log('🔐 AllTick client API key found, establishing direct connection...');
      
      // Direct connection to AllTick using client key
      this.ws = new WebSocket(`wss://quote.alltick.io/quote-ws-api?t=${encodeURIComponent(apiKey.trim())}`);
      
      this.ws.onopen = () => {
        console.log(`✅ AllTick WebSocket connected directly - subscribing immediately...`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.subscribeToPriceUpdates();
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
    } else {
      console.log('❌ Max AllTick reconnect attempts reached - no price data available');
    }
  }

  private subscribeToPriceUpdates() {
    if (!this.isConnected || !this.ws) return;

    // Subscribe to ALL available symbols for maximum real-time coverage
    const allSymbols = Object.values(this.symbolMapping);
    
    console.log(`🚀 Starting AllTick subscription with ALL symbols: ${allSymbols.join(', ')}`);
    
    // Subscribe to Latest Trade Price using cmd_id: 22001
    const subscriptionMessage = {
      cmd_id: 22001,
      seq_id: this.seqId++,
      trace: `frontend_price_sub_${Date.now()}`,
      data: {
        symbol_list: allSymbols.map(symbol => ({
          code: symbol
        }))
      }
    };

    console.log('📡 Sending AllTick frontend subscription for ALL symbols:', JSON.stringify(subscriptionMessage, null, 2));
    this.ws.send(JSON.stringify(subscriptionMessage));

    console.log(`📡 Subscribed to AllTick Latest Trade Prices from frontend (${allSymbols.length} symbols)`);
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);
      console.log('📨 AllTick frontend message received:', { 
        cmd_id: message.cmd_id, 
        ret_code: message.ret_code, 
        ret_msg: message.ret_msg,
        has_data: !!message.data
      });
      
      if (message.cmd_id === 22001) {
        if (message.ret_code === 0) {
          if (message.data && message.data.symbol_list) {
            console.log(`📊 AllTick frontend RT data: ${message.data.symbol_list.length} symbols`);
            this.handlePriceUpdate(message.data);
          } else {
            console.log('✅ AllTick frontend subscription confirmed successfully');
          }
        } else {
          console.error(`❌ AllTick frontend error - ret_code: ${message.ret_code}, ret_msg: ${message.ret_msg}`);
        }
      }
    } catch (error) {
      console.error('❌ Error parsing AllTick frontend message:', error);
    }
  }

  private handlePriceUpdate(data: any) {
    if (!data || !data.symbol_list) {
      console.log('⚠️ No symbol_list in AllTick frontend price data');
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
          source: 'AllTick-Direct'
        };

        // Notify all subscribers
        this.subscribers.forEach(callback => callback(priceData));
        updateCount++;
        
        console.log(`⚡ TICK: ${originalSymbol} = $${update.last_px} (${update.change_px || 0}%) - IMMEDIATE UPDATE`);
      }
    }
    
    if (updateCount > 0) {
      console.log(`🔥 PROCESSED ${updateCount} LIVE TICKS - NO BATCHING DELAY`);
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