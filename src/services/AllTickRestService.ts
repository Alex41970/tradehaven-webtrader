interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
  source?: string;
}

interface WebSocketMessage {
  type: string;
  prices?: PriceUpdate[];
  timestamp?: number;
  stats?: {
    requested: number;
    received: number;
    successRate: string;
  };
  cached?: boolean;
  message?: string;
  clientCount?: number;
}

/**
 * Binance WebSocket Service - Receives real-time crypto price updates
 * Connects to websocket-binance-streamer edge function
 * FREE unlimited real-time data from Binance
 * Updates: 1-3 second latency for all crypto assets
 */
export class AllTickRestService {
  private subscribers = new Set<(update: PriceUpdate) => void>();
  private websocket: WebSocket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  // Fallback/direct Binance connection state
  private directWs: WebSocket | null = null;
  private directReconnectAttempts = 0;
  private directReconnectTimeout: NodeJS.Timeout | null = null;
  private lastPriceReceivedAt: number | null = null;
  private fallbackTimer: NodeJS.Timeout | null = null;

  // Cache for 24h change when using direct Binance feed
  private change24h = new Map<string, number>();

  private websocketUrl = 'wss://stdfkfutgkmnaajixguz.supabase.co/functions/v1/websocket-binance-streamer';

  // Symbol maps (our symbol -> binance stream symbol)
  private readonly SYMBOL_MAP: Record<string, string> = {
    'BTCUSD': 'btcusdt',
    'ETHUSD': 'ethusdt',
    'BNBUSD': 'bnbusdt',
    'XRPUSD': 'xrpusdt',
    'ADAUSD': 'adausdt',
    'SOLUSD': 'solusdt',
    'DOGEUSD': 'dogeusdt',
    'DOTUSD': 'dotusdt',
    'MATICUSD': 'maticusdt',
    'LTCUSD': 'ltcusdt',
    'SHIBUSD': 'shibusdt',
    'AVAXUSD': 'avaxusdt',
    'LINKUSD': 'linkusdt',
    'UNIUSD': 'uniusdt',
    'ATOMUSD': 'atomusdt',
    'TRXUSD': 'trxusdt',
    'NEARUSD': 'nearusdt',
    'ICPUSD': 'icpusdt',
    'APTUSD': 'aptusdt',
    'FILUSD': 'filusdt',
    'ALGOUSD': 'algousdt',
    'GRTUSD': 'grtusdt',
    'SANDUSD': 'sandusdt',
    'MANAUSD': 'manausdt',
    'AAVEUSD': 'aaveusdt',
    'XLMUSD': 'xlmusdt',
    'VETUSD': 'vetusdt',
    'EOSUSD': 'eosusdt',
    'XTZUSD': 'xtzusdt',
    'THETAUSD': 'thetausdt',
    'AXSUSD': 'axsusdt',
    'FTMUSD': 'ftmusdt',
    'KSMUSD': 'ksmusdt',
    'HBARUSD': 'hbarusdt',
    'ZECUSD': 'zecusdt',
    'DASHUSD': 'dashusdt',
    'RUNEUSD': 'runeusdt',
    'ENJUSD': 'enjusdt',
    'BATUSD': 'batusdt',
    'YFIUSD': 'yfiusdt',
    'ZENUSDT': 'zenusdt',
    'ILVUSD': 'ilvusdt',
    'IMXUSD': 'imxusdt'
  };
  private readonly REVERSE_SYMBOL_MAP: Record<string, string> =
    Object.entries(this.SYMBOL_MAP).reduce((acc, [k, v]) => {
      acc[v.toUpperCase()] = k;
      return acc;
    }, {} as Record<string, string>);

  constructor() {
    console.log('🔌 Binance WebSocket Service initialized');
  }

  async connect(): Promise<boolean> {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      console.log('✅ Already connected to Binance WebSocket');
      return true;
    }

    return this.connectWebSocket();
  }

  private connectWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        console.log('🔌 Connecting to Binance WebSocket...');
        this.websocket = new WebSocket(this.websocketUrl);

        this.websocket.onopen = () => {
          console.log('✅ Connected to Binance WebSocket (real-time crypto)');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Start ping interval to keep connection alive
          this.startPingInterval();

          // Start fallback timer: if no price arrives shortly, connect directly to Binance
          if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
          this.lastPriceReceivedAt = null;
          this.fallbackTimer = setTimeout(() => {
            if (!this.lastPriceReceivedAt) {
              console.warn('⚠️ No price updates from edge in 5s. Falling back to direct Binance WS.');
              this.connectDirectBinance();
            }
          }, 5000);
          
          resolve(true);
        };

        this.websocket.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            
            if (message.type === 'price_update' && message.prices) {
              // Mark that we got prices from the edge feed
              this.lastPriceReceivedAt = Date.now();

              // Broadcast to all subscribers
              message.prices.forEach((priceData) => {
                const update: PriceUpdate = {
                  symbol: priceData.symbol,
                  price: priceData.price,
                  change_24h: priceData.change_24h || 0,
                  timestamp: priceData.timestamp || Date.now(),
                  source: 'Binance'
                };
                
                this.subscribers.forEach(callback => {
                  try {
                    callback(update);
                  } catch (error) {
                    console.error('Error in price update callback:', error);
                  }
                });
              });

              // Log stats
              if (message.stats) {
                const isCached = message.cached ? ' (cached)' : '';
                console.log(`📊 Binance: ${message.stats.received}/${message.stats.requested} symbols (${message.stats.successRate})${isCached}`);
              }
            } else if (message.type === 'connected') {
              console.log(`✅ ${message.message} (clients: ${message.clientCount})`);
            } else if (message.type === 'pong') {
              // Ping response - connection is alive
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };

        this.websocket.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          resolve(false);
        };

        this.websocket.onclose = () => {
          console.log('🔌 WebSocket connection closed');
          this.connected = false;
          this.stopPingInterval();
          
          // Attempt reconnection
          this.attemptReconnect();

          // Ensure prices keep flowing by falling back to direct Binance if edge feed is down
          if (!this.directWs || this.directWs.readyState !== WebSocket.OPEN) {
            this.connectDirectBinance();
          }
        };

      } catch (error) {
        console.error('❌ Failed to create WebSocket:', error);
        resolve(false);
      }
    });
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    
    // Send ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  subscribeToPrices(callback: (update: PriceUpdate) => void): () => void {
    this.subscribers.add(callback);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  isConnected(): boolean {
    return this.connected && this.websocket?.readyState === WebSocket.OPEN;
  }

  /**
   * Get the number of symbols being monitored (crypto only)
   */
  public getSymbolCount(): number {
    return Object.keys(this.SYMBOL_MAP).length;
  }

  // Fallback: connect directly to Binance if the edge relay is unavailable
  private connectDirectBinance(): void {
    try {
      if (this.directWs && (this.directWs.readyState === WebSocket.OPEN || this.directWs.readyState === WebSocket.CONNECTING)) {
        return;
      }

      console.log('🔌 [Fallback] Connecting directly to Binance WS...');
      this.directWs = new WebSocket('wss://stream.binance.com:9443/ws');

      this.directWs.onopen = () => {
        console.log('✅ [Fallback] Direct Binance WS connected');
        this.directReconnectAttempts = 0;

        // Build streams
        const binanceSymbols = Object.values(this.SYMBOL_MAP);
        const streams: string[] = [];
        binanceSymbols.forEach((s) => {
          streams.push(`${s}@trade`, `${s}@ticker`);
        });
        this.subscribeInBatches(this.directWs!, streams);
      };

      this.directWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleDirectMessage(data);
        } catch (e) {
          console.error('[Fallback] Error parsing Binance message:', e);
        }
      };

      this.directWs.onerror = (err) => {
        console.error('❌ [Fallback] Direct Binance WS error:', err);
      };

      this.directWs.onclose = () => {
        console.log('🔌 [Fallback] Direct Binance WS closed');
        // Reconnect with backoff
        this.directReconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.directReconnectAttempts - 1), 30000);
        if (this.directReconnectTimeout) clearTimeout(this.directReconnectTimeout);
        this.directReconnectTimeout = setTimeout(() => this.connectDirectBinance(), delay);
      };
    } catch (e) {
      console.error('❌ [Fallback] Failed to connect directly to Binance:', e);
    }
  }

  private subscribeInBatches(ws: WebSocket, streams: string[]) {
    const BATCH_SIZE = 40;
    for (let i = 0; i < streams.length; i += BATCH_SIZE) {
      const batch = streams.slice(i, i + BATCH_SIZE);
      const msg = { method: 'SUBSCRIBE', params: batch, id: Math.floor(Date.now() / 1000) + i };
      ws.send(JSON.stringify(msg));
      console.log(`📥 [Fallback] Sent subscription batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(streams.length / BATCH_SIZE)} (${batch.length} streams)`);
    }
  }

  private handleDirectMessage(data: any) {
    if (data?.result === null && data?.id) {
      // subscription ack
      return;
    }

    const eventType = data?.e;
    if (eventType === 'trade') {
      const binanceSymbol = data.s as string; // e.g. BTCUSDT
      const ourSymbol = this.REVERSE_SYMBOL_MAP[binanceSymbol?.toUpperCase()];
      if (!ourSymbol) return;

      const price = parseFloat(data.p);
      const change = this.change24h.get(ourSymbol) || 0;
      const update: PriceUpdate = {
        symbol: ourSymbol,
        price,
        change_24h: change,
        timestamp: data.E || Date.now(),
        source: 'Binance'
      };

      // deliver to subscribers
      this.subscribers.forEach(cb => {
        try { cb(update); } catch (e) { console.error('Callback error:', e); }
      });

    } else if (eventType === '24hrTicker') {
      const binanceSymbol = data.s as string;
      const ourSymbol = this.REVERSE_SYMBOL_MAP[binanceSymbol?.toUpperCase()];
      if (!ourSymbol) return;
      const changePercent = parseFloat(data.P);
      if (!Number.isNaN(changePercent)) this.change24h.set(ourSymbol, changePercent);
    }
  }
 
  disconnect(): void {
    console.log('🔌 Disconnecting from Binance WebSocket(s)');
    
    this.stopPingInterval();
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.directReconnectTimeout) {
      clearTimeout(this.directReconnectTimeout);
      this.directReconnectTimeout = null;
    }
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    if (this.directWs) {
      try { this.directWs.close(); } catch {}
      this.directWs = null;
    }
    
    this.connected = false;
    this.subscribers.clear();
    this.reconnectAttempts = 0;
    this.directReconnectAttempts = 0;
  }
}

