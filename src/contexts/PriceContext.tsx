import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { useOptimizedPriceUpdates } from '@/hooks/useOptimizedPriceUpdates';

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
}

interface PriceContextType {
  prices: Map<string, PriceUpdate>;
  isConnected: boolean;
  lastUpdate: Date | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error' | 'paused';
  isPaused: boolean;
}

const PriceContext = createContext<PriceContextType | undefined>(undefined);

export const usePrices = () => {
  const context = useContext(PriceContext);
  if (!context) {
    throw new Error('usePrices must be used within a PriceProvider');
  }
  return context;
};

interface PriceProviderProps {
  children: React.ReactNode;
}

export const PriceProvider = ({ children }: PriceProviderProps) => {
  const { prices, lastUpdate, addPriceUpdates } = useOptimizedPriceUpdates();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error' | 'paused'>('disconnected');
  const [isPaused, setIsPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisible = useRef(true);
  const clientIdRef = useRef<string>((typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : Math.random().toString(36).slice(2));

  // Page visibility optimization to reduce messages when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisible.current = !document.hidden;
      console.log('Price updates', document.hidden ? 'paused (tab hidden)' : 'resumed (tab visible)');
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, []);

  const connectWebSocket = () => {
    try {
      setConnectionStatus('connecting');
      setIsPaused(false);
      
      // Clear any existing connection timeout
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
      
      // Use the full WebSocket URL for the edge function
      // Ensure WS uses the correct full URL (Supabase Functions)
      const wsUrl = `wss://stdfkfutgkmnaajixguz.functions.supabase.co/functions/v1/realtime-prices`;
      console.log('🔌 Connecting to price WS:', wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Real-time price WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        
        // Clear connection timeout on successful connection
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        // Send an initial heartbeat so server marks client active
        try {
          wsRef.current?.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now(),
            client_id: clientIdRef.current
          }));
        } catch (err) {
          console.warn('Failed to send initial heartbeat', err);
        }
      };

      wsRef.current.onmessage = (event) => {
        // Skip processing price updates when tab is hidden
        if (!isPageVisible.current) {
          console.log('Skipping price update processing - tab hidden');
          return;
        }

        try {
          const message = JSON.parse(event.data);
          console.log('🔄 WebSocket message received:', message.type, message.data?.length, 'updates', 'source:', message.metadata?.source);
          
          if (message.type === 'initial_prices' || message.type === 'price_update') {
            // Use optimized batching instead of direct state updates
            if (Array.isArray(message.data) && message.data.length > 0) {
              const first = message.data[0];
              console.log('🔎 First price sample:', first.symbol, first.price, 'src=', first.source);
            }
            addPriceUpdates(message.data);
          } else if (message.type === 'error') {
            console.error('Price service error:', message.message);
            setConnectionStatus('error');
          }
        } catch (error) {
          console.error('Error parsing price message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('Price WebSocket disconnected');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        // Clear connection timeout
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        
        // Attempt to reconnect with exponential backoff (max 3 attempts)
        if (reconnectAttempts.current < 3) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000;
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        } else {
          console.log('Max reconnect attempts reached, staying in database mode');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Price WebSocket error:', error);
        setConnectionStatus('error');
        
        // Clear connection timeout on error
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
      };

    } catch (error) {
      console.error('Failed to connect to price WebSocket:', error);
      setConnectionStatus('error');
    }
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
    };
  }, []);

  // Send heartbeat every 30s to keep server active
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now(), client_id: clientIdRef.current }));
      }
    }, 15000); // heartbeat faster to keep server in active mode
    return () => clearInterval(interval);
  }, [isConnected]);

  return (
    <PriceContext.Provider value={{
      prices,
      isConnected,
      lastUpdate,
      connectionStatus,
      isPaused
    }}>
      {/* SEO essentials for dashboard */}
      <header>
        <title>Live Trading Dashboard | Real-time Prices</title>
        <meta name="description" content="Live trading prices and portfolio updates in real time" />
        <link rel="canonical" href="/dashboard" />
      </header>
      {children}
    </PriceContext.Provider>
  );
};