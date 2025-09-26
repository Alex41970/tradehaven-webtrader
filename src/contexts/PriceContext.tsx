import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { useActivity } from './ActivityContext';

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
  const { isUserActive } = useActivity();
  const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error' | 'paused'>('disconnected');
  const [isPaused, setIsPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisible = useRef(true);
  const wasUserActiveRef = useRef(true);

  // Activity-based connection management
  useEffect(() => {
    const wasActive = wasUserActiveRef.current;
    wasUserActiveRef.current = isUserActive;

    if (isUserActive && !wasActive) {
      // User became active - resume connection
      console.log('🔄 Price WebSocket: User became active, resuming connection');
      setIsPaused(false);
      if (!isConnected && !wsRef.current) {
        connectWebSocket();
      }
    } else if (!isUserActive && wasActive) {
      // User became inactive - pause connection
      console.log('⏸️ Price WebSocket: User became inactive, pausing connection');
      setIsPaused(true);
      setConnectionStatus('paused');
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    }
  }, [isUserActive]);

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
    // Don't connect if user is inactive
    if (!isUserActive) {
      console.log('⏸️ Price WebSocket: Skipping connection - user is inactive');
      setConnectionStatus('paused');
      setIsPaused(true);
      return;
    }

    try {
      setConnectionStatus('connecting');
      setIsPaused(false);
      
      // Clear any existing connection timeout
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
      
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
        // Skip processing price updates when tab is hidden or user is inactive
        if (!isPageVisible.current || !isUserActive) {
          console.log('Skipping price update processing - tab hidden or user inactive');
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
        
        // Only attempt to reconnect if user is still active
        if (isUserActive && reconnectAttempts.current < 3) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000;
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        } else if (!isUserActive) {
          console.log('Not reconnecting - user is inactive');
          setConnectionStatus('paused');
          setIsPaused(true);
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
    // Only connect if user is active on initial mount
    if (isUserActive) {
      connectWebSocket();
    } else {
      setConnectionStatus('paused');
      setIsPaused(true);
    }

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
  }, []); // Remove isUserActive dependency to prevent reconnection loops

  return (
    <PriceContext.Provider value={{
      prices,
      isConnected,
      lastUpdate,
      connectionStatus,
      isPaused
    }}>
      {children}
    </PriceContext.Provider>
  );
};