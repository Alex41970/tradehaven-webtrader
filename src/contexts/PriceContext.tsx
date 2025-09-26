import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

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
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
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
  const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisible = useRef(true);

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
      
      // Clear any existing connection timeout
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
      
      // Remove connection timeout to prevent frequent disconnections
      
      // Use the full WebSocket URL for the edge function
      const wsUrl = `wss://stdfkfutgkmnaajixguz.functions.supabase.co/functions/v1/realtime-prices`;
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
      };

      wsRef.current.onmessage = (event) => {
        // Skip processing price updates when tab is hidden to reduce CPU usage
        if (!isPageVisible.current) {
          console.log('Skipping price update processing - tab is hidden');
          return;
        }

        try {
          const message = JSON.parse(event.data);
          console.log('🔄 WebSocket message received:', message.type, message.data?.length, 'updates');
          
          if (message.type === 'initial_prices' || message.type === 'price_update') {
            setPrices(prevPrices => {
              const newPrices = new Map(prevPrices);
              let updateCount = 0;
              
              message.data.forEach((update: PriceUpdate) => {
                newPrices.set(update.symbol, update);
                updateCount++;
              });
              
              console.log('💹 Updated', updateCount, 'prices in Map, total symbols:', newPrices.size);
              return newPrices;
            });
            setLastUpdate(new Date());
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

  return (
    <PriceContext.Provider value={{
      prices,
      isConnected,
      lastUpdate,
      connectionStatus
    }}>
      {children}
    </PriceContext.Provider>
  );
};