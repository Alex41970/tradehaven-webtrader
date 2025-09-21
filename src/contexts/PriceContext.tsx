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

  const connectWebSocket = () => {
    try {
      setConnectionStatus('connecting');
      
      // Use the full WebSocket URL for the edge function
      const wsUrl = `wss://stdfkfutgkmnaajixguz.functions.supabase.co/functions/v1/realtime-prices`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Real-time price WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'initial_prices' || message.type === 'price_update') {
            const newPrices = new Map(prices);
            
            message.data.forEach((update: PriceUpdate) => {
              newPrices.set(update.symbol, update);
            });
            
            setPrices(newPrices);
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
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < 5) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000;
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Price WebSocket error:', error);
        setConnectionStatus('error');
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