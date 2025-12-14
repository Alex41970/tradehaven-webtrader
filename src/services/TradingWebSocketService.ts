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
  private circuitBreakerResetTime = 5 * 60 * 1000;
  private lastCircuitBreakerReset = 0;
  private isUserActive = true;
  private connecting = false;
  
  private readonly wsUrl = `wss://stdfkfutgkmnaajixguz.functions.supabase.co/functions/v1/websocket-trading-updates`;

  constructor() {
    this.setupEventHandlers();
    this.setupNetworkStateHandlers();
    this.setupVisibilityHandlers();
  }

  private setupEventHandlers() {
    this.on('auth_success', () => {
      this.isAuthenticated = true;
      this.reconnectAttempts = 0;
      this.connectionState.quality = 'excellent';
      this.startKeepAlive();
      this.subscribe(['profile_updates', 'trade_updates', 'margin_updates']);
    });

    this.on('auth_error', () => {
      this.isAuthenticated = false;
      this.connectionState.quality = 'offline';
      this.stopKeepAlive();
    });

    this.on('error', () => {
      this.connectionState.quality = 'poor';
    });

    this.on('pong', (message) => {
      const now = Date.now();
      const pingTime = message.timestamp || now;
      this.connectionState.lastPongTime = now;
      this.connectionState.latency = now - pingTime;
      this.connectionState.missedPings = 0;
      
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
            this.reconnectAttempts = 0;
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
          this.stopKeepAlive();
          this.startKeepAlive(300000);
        }
      };
      
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    }
  }

  private startKeepAlive(interval = 60000) {
    this.stopKeepAlive();
    
    this.keepAliveInterval = setInterval(() => {
      if (this.isConnected() && this.isUserActive) {
        const pingTime = Date.now();
        this.ping(pingTime);
        
        this.pingTimeout = setTimeout(() => {
          this.connectionState.missedPings++;
          
          if (this.connectionState.missedPings >= 3) {
            this.connectionState.quality = 'offline';
            this.disconnect();
            this.handleReconnect();
          }
        }, 10000);
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
    if (this.connecting) return;
    if (this.isReconnecting) return;
    if (!this.isUserActive) return;

    if (this.shouldCircuitBreakerActivate()) {
      const delay = this.circuitBreakerResetTime - (Date.now() - this.lastCircuitBreakerReset);
      setTimeout(() => this.connect(), Math.max(delay, 60000));
      return;
    }

    try {
      this.connecting = true;
      
      if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
        this.connecting = false;
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.connecting = false;
        return;
      }

      this.isReconnecting = true;
      this.ws = new WebSocket(this.wsUrl);

      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      }, 15000);

      this.ws.onopen = async () => {
        clearTimeout(connectionTimeout);
        this.isReconnecting = false;
        this.connecting = false;
        await this.authenticate();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: TradingWebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch {
          // Silent fail
        }
      };

      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        this.isAuthenticated = false;
        this.isReconnecting = false;
        this.connecting = false;
        this.connectionState.quality = 'offline';
        this.stopKeepAlive();
        
        if (event.code !== 1000) {
          this.handleReconnect();
        }
      };

      this.ws.onerror = () => {
        clearTimeout(connectionTimeout);
        this.isAuthenticated = false;
        this.isReconnecting = false;
        this.connecting = false;
        this.connectionState.quality = 'offline';
      };

    } catch {
      this.isReconnecting = false;
      this.connecting = false;
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
      const now = Date.now();
      if (now - this.lastTokenRefresh > 55 * 60 * 1000) {
        await supabase.auth.refreshSession();
        this.lastTokenRefresh = now;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        return;
      }

      this.send({
        type: 'auth',
        token: session.access_token
      });

    } catch {
      setTimeout(() => this.authenticate(), 5000);
    }
  }

  private handleMessage(message: TradingWebSocketMessage) {    
    const handlers = this.eventHandlers.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message);
      } catch {
        // Silent fail
      }
    });
  }

  private handleReconnect() {
    if (this.isReconnecting) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (!this.isUserActive) return;

    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    this.reconnectAttempts++;
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private subscribe(channels: string[]) {
    if (!this.isAuthenticated) return;

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
      }, 15000);

      const handleResponse = () => {
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
      }, 15000);

      const handleResponse = () => {
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
      this.ws.close(1000, 'Manual disconnect');
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

  setUserActivity(isActive: boolean) {
    const wasActive = this.isUserActive;
    this.isUserActive = isActive;

    if (isActive && !wasActive) {
      if (!this.isConnected()) {
        this.connect();
      } else {
        this.startKeepAlive(60000);
      }
    } else if (!isActive && wasActive) {
      this.startKeepAlive(300000);
    }
  }

  cleanup() {
    this.disconnect();
    
    if (this.visibilityChangeHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    
    if (this.networkChangeHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.networkChangeHandler);
      window.removeEventListener('offline', this.networkChangeHandler);
    }

    this.eventHandlers.clear();
    this.subscriptions.clear();
  }
}

export const tradingWebSocketService = new TradingWebSocketService();
