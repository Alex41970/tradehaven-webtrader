import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AllTickWebSocketService } from '@/services/AllTickWebSocketService';
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
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  isPaused: boolean;
}

const PriceContext = createContext<PriceContextType | undefined>(undefined);

export const usePrices = () => {
  const context = useContext(PriceContext);
  if (context === undefined) {
    throw new Error('usePrices must be used within a PriceProvider');
  }
  return context;
};

interface PriceProviderProps {
  children: React.ReactNode;
}

export const PriceProvider: React.FC<PriceProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [isPaused, setIsPaused] = useState(false);

  const { 
    prices, 
    lastUpdate: optimizedLastUpdate, 
    addPriceUpdate,
    processBatch 
  } = useOptimizedPriceUpdates();

  const allTickServiceRef = useRef<AllTickWebSocketService | null>(null);

  // Initialize AllTick connection
  useEffect(() => {
    const initAllTick = async () => {
      console.log('🚀 Initializing AllTick-only WebSocket service...');
      
      allTickServiceRef.current = new AllTickWebSocketService();
      
      const unsubscribe = allTickServiceRef.current.subscribeToPrices((priceUpdate) => {
        console.log('📨 AllTick price received:', priceUpdate.symbol, priceUpdate.price);
        addPriceUpdate(priceUpdate);
        
        // Immediately flush the update to ensure instant display
        processBatch();
        
        setLastUpdate(new Date(priceUpdate.timestamp));
        setIsConnected(true);
        setConnectionStatus('connected');
      });
      
      const connected = await allTickServiceRef.current.connect();
      
      if (connected) {
        console.log('✅ AllTick WebSocket connected successfully');
        setIsConnected(true);
        setConnectionStatus('connected');
      } else {
        console.log('❌ AllTick WebSocket failed to connect');
        setIsConnected(false);
        setConnectionStatus('error');
      }
      
      return unsubscribe;
    };

    initAllTick();

    return () => {
      if (allTickServiceRef.current) {
        allTickServiceRef.current.disconnect();
      }
    };
  }, [addPriceUpdate, processBatch]);

  // Handle page visibility for performance
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('🔇 Page hidden - marking as paused');
        setIsPaused(true);
      } else {
        console.log('🔊 Page visible - resuming');
        setIsPaused(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const value: PriceContextType = {
    prices,
    isConnected,
    lastUpdate: optimizedLastUpdate || lastUpdate,
    connectionStatus,
    isPaused,
  };

  return (
    <PriceContext.Provider value={value}>
      {children}
    </PriceContext.Provider>
  );
};