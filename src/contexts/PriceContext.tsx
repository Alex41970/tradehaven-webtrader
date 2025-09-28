import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { useOptimizedPriceUpdates } from '@/hooks/useOptimizedPriceUpdates';
import { AllTickWebSocketService } from '@/services/AllTickWebSocketService';

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
  allTickConnected: boolean;
  edgeFunctionConnected: boolean;
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
  const { prices, lastUpdate, addPriceUpdates, processBatch } = useOptimizedPriceUpdates();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error' | 'paused'>('disconnected');
  const [isPaused, setIsPaused] = useState(false);
  const [allTickConnected, setAllTickConnected] = useState(false);
  const [edgeFunctionConnected, setEdgeFunctionConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const allTickServiceRef = useRef<AllTickWebSocketService | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisible = useRef(true);
  const clientIdRef = useRef<string>((typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  const edgePausedRef = useRef<boolean>(false);

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

  // Initialize AllTick direct connection
  const connectAllTick = async () => {
    if (!allTickServiceRef.current) {
      allTickServiceRef.current = new AllTickWebSocketService();
    }
    
    // Subscribe to AllTick price updates
    allTickServiceRef.current.subscribeToPrices((priceData) => {
      if (!isPageVisible.current) return; // Skip if tab hidden
      
      console.log('📊 AllTick Direct update:', priceData.symbol, priceData.price, 'source:', priceData.source);
      addPriceUpdates([priceData]);
      // Flush immediately for ultra-low latency
      processBatch();
    });

    // Connect and update status
    const connected = await allTickServiceRef.current.connect();
    setAllTickConnected(connected);
    
    // Update overall connection status
    updateConnectionStatus();
  };

  // Update overall connection status based on both connections
  const updateConnectionStatus = () => {
    const anyConnected = allTickConnected || edgeFunctionConnected;
    setIsConnected(anyConnected);
    
    if (allTickConnected && edgeFunctionConnected) {
      setConnectionStatus('connected');
      console.log('🚀 Both AllTick and Edge Function connected - dual data feed active');
    } else if (allTickConnected) {
      setConnectionStatus('connected');
      console.log('⚡ AllTick direct connected - real-time prices active');
    } else if (edgeFunctionConnected) {
      setConnectionStatus('connected');
      console.log('🔄 Edge Function connected - fallback prices active');
    } else {
      setConnectionStatus('disconnected');
      console.log('❌ No price connections active');
    }
  };

  // Update connection status whenever individual connections change
  useEffect(() => {
    updateConnectionStatus();
  }, [allTickConnected, edgeFunctionConnected]);

  // Pause/resume Edge Function based on AllTick direct connection to save Supabase usage
  useEffect(() => {
    if (allTickConnected) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('🧘 Pausing Edge Function price feed (AllTick direct active)');
        edgePausedRef.current = true;
        try {
          wsRef.current.close();
        } catch (e) {
          console.warn('Failed to close Edge Function WS while pausing', e);
        }
      } else {
        edgePausedRef.current = true;
      }
    } else {
      if (edgePausedRef.current && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        console.log('🔄 Resuming Edge Function price feed (AllTick not active)');
        edgePausedRef.current = false;
        connectWebSocket();
      }
    }
  }, [allTickConnected]);

  const connectWebSocket = () => {
    try {
      if (edgePausedRef.current) {
        console.log('⏸️ Edge Function connect skipped (paused due to AllTick)');
        return;
      }
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
        console.log('Edge Function WebSocket connected');
        setEdgeFunctionConnected(true);
        updateConnectionStatus();
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
        console.log('Edge Function WebSocket disconnected');
        setEdgeFunctionConnected(false);
        updateConnectionStatus();
        
        // Clear connection timeout
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        
        // Attempt to reconnect with exponential backoff (max 3 attempts) unless paused
        if (!edgePausedRef.current && reconnectAttempts.current < 3) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000;
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        } else {
          if (edgePausedRef.current) {
            console.log('⏹️ Edge Function reconnection suppressed (paused due to AllTick)');
          } else {
            console.log('Max reconnect attempts reached, staying in database mode');
          }
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
    // Start both connections
    connectWebSocket();
    connectAllTick();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (allTickServiceRef.current) {
        allTickServiceRef.current.disconnect();
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
      isPaused,
      allTickConnected,
      edgeFunctionConnected
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