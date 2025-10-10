import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AllTickRestService } from '@/services/AllTickRestService';
import { useOptimizedPriceUpdates } from '@/hooks/useOptimizedPriceUpdates';

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
  source?: string;
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
  console.log('🔥 PRICE PROVIDER COMPONENT CREATED - INITIALIZING NOW');
  
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

  const allTickServiceRef = useRef<AllTickRestService | null>(null);

  // Initialize AllTick REST connection
  useEffect(() => {
    console.log('🔥 PRICE PROVIDER USE EFFECT FIRED - STARTING ALLTICK REST CONNECTION');
    
    const initAllTick = async () => {
      console.log('🚀 PriceProvider: Initializing AllTick REST service via backend relay...');
      
      try {
        allTickServiceRef.current = new AllTickRestService();
        
        const unsubscribe = allTickServiceRef.current.subscribeToPrices((priceUpdate) => {
          console.log(`⚡ REST PRICE RECEIVED: ${priceUpdate.symbol} = $${priceUpdate.price} (${priceUpdate.change_24h}%) - Source: ${priceUpdate.source}`);
          addPriceUpdate(priceUpdate);
          console.log(`📊 Price added to Map, current Map size: ${prices.size}`);
          
          setLastUpdate(new Date(priceUpdate.timestamp));
          setIsConnected(true);
          setConnectionStatus('connected');
        });
        
        console.log('🔌 Starting AllTick REST polling...');
        const connected = await allTickServiceRef.current.connect();
        
        if (connected) {
          console.log('✅ AllTick REST service started successfully');
          console.log(`📊 AllTick monitoring ${allTickServiceRef.current.getSymbolCount()} symbols`);
          setConnectionStatus('connecting');
        } else {
          console.log('❌ AllTick REST service failed to start');
          setIsConnected(false);
          setConnectionStatus('error');
        }
        
        return unsubscribe;
      } catch (error) {
        console.error('❌ AllTick REST service initialization error:', error);
        setConnectionStatus('error');
      }
    };

    initAllTick();

    return () => {
      if (allTickServiceRef.current) {
        console.log('🔌 PriceProvider: Disconnecting AllTick REST service...');
        allTickServiceRef.current.disconnect();
      }
    };
  }, [addPriceUpdate]);

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