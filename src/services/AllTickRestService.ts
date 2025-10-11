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
  
  private websocketUrl = 'wss://stdfkfutgkmnaajixguz.supabase.co/functions/v1/websocket-binance-streamer';

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
          
          resolve(true);
        };

        this.websocket.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            
            if (message.type === 'price_update' && message.prices) {
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
    return 43; // Total crypto assets
  }

  disconnect(): void {
    console.log('🔌 Disconnecting from Binance WebSocket');
    
    this.stopPingInterval();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.connected = false;
    this.subscribers.clear();
    this.reconnectAttempts = 0;
  }
}
