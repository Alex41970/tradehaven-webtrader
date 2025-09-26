import { supabase } from '@/integrations/supabase/client';

export interface TradingWebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface TradeData {
  assetId: string;
  symbol: string;
  tradeType: 'BUY' | 'SELL';
  amount: number;
  leverage: number;
  openPrice: number;
  marginUsed: number;
  stopLoss?: number;
  takeProfit?: number;
}

export type TradingWebSocketEventCallback = (message: TradingWebSocketMessage) => void;

interface ConnectionState {
  quality: 'excellent' | 'good' | 'poor' | 'offline';
  lastPongTime: number;
  latency: number;
  missedPings: number;
}

export class TradingWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private pingTimeout: NodeJS.Timeout | null = null;
  private isAuthenticated = false;
  private eventHandlers = new Map<string, TradingWebSocketEventCallback[]>();
  private subscriptions = new Set<string>();
  private connectionState: ConnectionState = {
    quality: 'offline',
    lastPongTime: 0,
    latency: 0,
    missedPings: 0
  };
  private visibilityChangeHandler: (() => void) | null = null;
  private networkChangeHandler: (() => void) | null = null;
  private isReconnecting = false;
  private lastTokenRefresh = 0;
  private circuitBreakerThreshold = 10;
  private circuitBreakerResetTime = 5 * 60 * 1000; // 5 minutes
  private lastCircuitBreakerReset = 0;
  
  private readonly wsUrl = `wss://stdfkfutgkmnaajixguz.functions.supabase.co/functions/v1/websocket-trading-updates`;

  constructor() {
    this.setupEventHandlers();
    this.setupNetworkStateHandlers();
    this.setupVisibilityHandlers();
  }

  private setupEventHandlers() {
    this.on('auth_success', (message) => {
      this.isAuthenticated = true;
      this.reconnectAttempts = 0;
      this.connectionState.quality = 'excellent';
      this.startKeepAlive();
      
      // Subscribe to user-specific channels after authentication
      this.subscribe(['profile_updates', 'trade_updates', 'margin_updates']);
    });

    this.on('auth_error', (message) => {
      console.error('WebSocket authentication failed:', message.message);
      this.isAuthenticated = false;
      this.connectionState.quality = 'offline';
      this.stopKeepAlive();
    });

    this.on('error', (message) => {
      console.error('WebSocket error:', message.message);
      this.connectionState.quality = 'poor';
    });

    this.on('pong', (message) => {
      const now = Date.now();
      const pingTime = message.timestamp || now;
      this.connectionState.lastPongTime = now;
      this.connectionState.latency = now - pingTime;
      this.connectionState.missedPings = 0;
      
      // Update connection quality based on latency
      if (this.connectionState.latency < 100) {
        this.connectionState.quality = 'excellent';
      } else if (this.connectionState.latency < 300) {
        this.connectionState.quality = 'good';
      } else {
        this.connectionState.quality = 'poor';
      }
    });
  }

  private setupNetworkStateHandlers() {
    if (typeof window !== 'undefined') {
      this.networkChangeHandler = () => {
        if (navigator.onLine) {
          if (!this.isConnected() && !this.isReconnecting) {
            this.reconnectAttempts = 0; // Reset attempts on network recovery
            this.connect();
          }
        } else {
          this.connectionState.quality = 'offline';
          this.stopKeepAlive();
        }
      };
      
      window.addEventListener('online', this.networkChangeHandler);
      window.addEventListener('offline', this.networkChangeHandler);
    }
  }

  private setupVisibilityHandlers() {
    if (typeof document !== 'undefined') {
      this.visibilityChangeHandler = () => {
        if (document.visibilityState === 'visible') {
          if (!this.isConnected() && !this.isReconnecting && navigator.onLine) {
            this.connect();
          }
        } else {
          // Keep connection but reduce ping frequency significantly when hidden
          this.stopKeepAlive();
          this.startKeepAlive(120000); // Ping every 2 minutes when hidden
        }
      };
      
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    }
  }

  private startKeepAlive(interval = 60000) {
    this.stopKeepAlive();
    
    this.keepAliveInterval = setInterval(() => {
      if (this.isConnected()) {
        const pingTime = Date.now();
        this.ping(pingTime);
        
        // Set timeout for pong response
        this.pingTimeout = setTimeout(() => {
          this.connectionState.missedPings++;
          
          if (this.connectionState.missedPings >= 3) {
            this.connectionState.quality = 'offline';
            this.disconnect();
            this.handleReconnect();
          }
        }, 10000); // 10 second timeout for pong
      }
    }, interval);
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }

  async connect() {
    if (this.isReconnecting) {
      return;
    }

    // Check circuit breaker
    if (this.shouldCircuitBreakerActivate()) {
      const delay = this.circuitBreakerResetTime - (Date.now() - this.lastCircuitBreakerReset);
      setTimeout(() => this.connect(), Math.max(delay, 60000));
      return;
    }

    try {
      if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
        return;
      }

      // Check if we're online
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }

      this.isReconnecting = true;
      this.ws = new WebSocket(this.wsUrl);

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      }, 15000);

      this.ws.onopen = async () => {
        clearTimeout(connectionTimeout);
        this.isReconnecting = false;
        await this.authenticate();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: TradingWebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        this.isAuthenticated = false;
        this.isReconnecting = false;
        this.connectionState.quality = 'offline';
        this.stopKeepAlive();
        
        // Don't reconnect if it was a manual close (code 1000)
        if (event.code !== 1000) {
          this.handleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('Trading WebSocket error:', error);
        this.isAuthenticated = false;
        this.isReconnecting = false;
        this.connectionState.quality = 'offline';
      };

    } catch (error) {
      console.error('Failed to connect to trading WebSocket:', error);
      this.isReconnecting = false;
      this.handleReconnect();
    }
  }

  private shouldCircuitBreakerActivate(): boolean {
    if (this.reconnectAttempts < this.circuitBreakerThreshold) {
      return false;
    }

    const timeSinceLastReset = Date.now() - this.lastCircuitBreakerReset;
    if (timeSinceLastReset > this.circuitBreakerResetTime) {
      this.reconnectAttempts = 0;
      this.lastCircuitBreakerReset = Date.now();
      return false;
    }

    return true;
  }

  private async authenticate() {
    try {
      // Check if token needs refresh
      const now = Date.now();
      if (now - this.lastTokenRefresh > 55 * 60 * 1000) { // Refresh every 55 minutes
        await supabase.auth.refreshSession();
        this.lastTokenRefresh = now;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.error('No authentication token available');
        return;
      }

      this.send({
        type: 'auth',
        token: session.access_token
      });

    } catch (error) {
      console.error('Authentication failed:', error);
      // Retry authentication after delay
      setTimeout(() => this.authenticate(), 5000);
    }
  }

  private handleMessage(message: TradingWebSocketMessage) {    
    const handlers = this.eventHandlers.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in WebSocket event handler:', error);
      }
    });
  }

  private handleReconnect() {
    if (this.isReconnecting) {
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    // Calculate delay with jittered exponential backoff
    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    const jitter = Math.random() * 1000; // Add up to 1 second jitter
    const delay = baseDelay + jitter;

    this.reconnectAttempts++;
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private subscribe(channels: string[]) {
    if (!this.isAuthenticated) {
      return;
    }

    channels.forEach(channel => this.subscriptions.add(channel));

    this.send({
      type: 'subscribe',
      channels: Array.from(this.subscriptions)
    });
  }

  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // Public API methods
  on(event: string, callback: TradingWebSocketEventCallback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(callback);
  }

  off(event: string, callback: TradingWebSocketEventCallback) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  async openTrade(tradeData: TradeData): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Trade open timeout'));
      }, 15000); // Increased timeout

      const handleResponse = (message: TradingWebSocketMessage) => {
        clearTimeout(timeout);
        this.off('trade_opened', handleResponse);
        this.off('trade_error', handleError);
        resolve(true);
      };

      const handleError = (message: TradingWebSocketMessage) => {
        clearTimeout(timeout);
        this.off('trade_opened', handleResponse);
        this.off('trade_error', handleError);
        reject(new Error(message.message || 'Trade open failed'));
      };

      this.on('trade_opened', handleResponse);
      this.on('trade_error', handleError);

      this.send({
        type: 'trade_action',
        action: 'open_trade',
        data: tradeData
      });
    });
  }

  async closeTrade(tradeId: string, closePrice: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Trade close timeout'));
      }, 15000); // Increased timeout

      const handleResponse = (message: TradingWebSocketMessage) => {
        clearTimeout(timeout);
        this.off('trade_closed', handleResponse);
        this.off('trade_error', handleError);
        resolve(true);
      };

      const handleError = (message: TradingWebSocketMessage) => {
        clearTimeout(timeout);
        this.off('trade_closed', handleResponse);
        this.off('trade_error', handleError);
        reject(new Error(message.message || 'Trade close failed'));
      };

      this.on('trade_closed', handleResponse);
      this.on('trade_error', handleError);

      this.send({
        type: 'trade_action',
        action: 'close_trade',
        data: { tradeId, closePrice }
      });
    });
  }

  ping(timestamp?: number) {
    this.send({ 
      type: 'ping',
      timestamp: timestamp || Date.now()
    });
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopKeepAlive();

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect'); // Normal closure
      this.ws = null;
    }

    this.isAuthenticated = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.connectionState.quality = 'offline';
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated;
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  // Cleanup method for component unmount
  cleanup() {
    this.disconnect();
    
    if (this.networkChangeHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.networkChangeHandler);
      window.removeEventListener('offline', this.networkChangeHandler);
    }
    
    if (this.visibilityChangeHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
  }
}

// Singleton instance
export const tradingWebSocket = new TradingWebSocketService();
