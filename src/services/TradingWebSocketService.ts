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
}

export type TradingWebSocketEventCallback = (message: TradingWebSocketMessage) => void;

export class TradingWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isAuthenticated = false;
  private eventHandlers = new Map<string, TradingWebSocketEventCallback[]>();
  private subscriptions = new Set<string>();
  
  private readonly wsUrl = `wss://stdfkfutgkmnaajixguz.functions.supabase.co/functions/v1/websocket-trading-updates`;

  constructor() {
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Setup default event handlers
    this.on('auth_success', (message) => {
      console.log('WebSocket authenticated successfully');
      this.isAuthenticated = true;
      this.reconnectAttempts = 0;
      
      // Subscribe to user-specific channels after authentication
      this.subscribe(['profile_updates', 'trade_updates', 'margin_updates']);
    });

    this.on('auth_error', (message) => {
      console.error('WebSocket authentication failed:', message.message);
      this.isAuthenticated = false;
    });

    this.on('error', (message) => {
      console.error('WebSocket error:', message.message);
    });

    this.on('pong', () => {
      // Keep connection alive
    });
  }

  async connect() {
    try {
      if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
        console.log('WebSocket already connected or connecting');
        return;
      }

      console.log('Connecting to trading WebSocket...');
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = async () => {
        console.log('Trading WebSocket connected');
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

      this.ws.onclose = () => {
        console.log('Trading WebSocket disconnected');
        this.isAuthenticated = false;
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('Trading WebSocket error:', error);
        this.isAuthenticated = false;
      };

    } catch (error) {
      console.error('Failed to connect to trading WebSocket:', error);
      this.handleReconnect();
    }
  }

  private async authenticate() {
    try {
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
    }
  }

  private handleMessage(message: TradingWebSocketMessage) {
    console.log('Received WebSocket message:', message.type);
    
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
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
    this.reconnectAttempts++;

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private subscribe(channels: string[]) {
    if (!this.isAuthenticated) {
      console.warn('Cannot subscribe: not authenticated');
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
    } else {
      console.warn('WebSocket not connected, cannot send message:', message.type);
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
      }, 10000); // 10 second timeout

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
      }, 10000); // 10 second timeout

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

  ping() {
    this.send({ type: 'ping' });
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated;
  }
}

// Singleton instance
export const tradingWebSocket = new TradingWebSocketService();
