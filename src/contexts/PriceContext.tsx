import React, { createContext, useContext, useEffect } from 'react';
import { useSmartPriceSubscription } from '@/hooks/useSmartPriceSubscription';
import { useOptimizedPriceUpdates } from '@/hooks/useOptimizedPriceUpdates';
import { supabase } from '@/integrations/supabase/client';

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
  source?: string;
  mode?: 'websocket' | 'polling' | 'offline';
}

interface PriceContextType {
  prices: Map<string, PriceUpdate>;
  isConnected: boolean;
  lastUpdate: Date | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'paused';
  isUserActive: boolean;
  connectionMode: 'websocket' | 'polling' | 'offline';
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
  // Get real prices from server (every ~10 min)
  const {
    prices: serverPrices,
    isConnected,
    connectionStatus,
    isUserActive,
    connectionMode,
  } = useSmartPriceSubscription();

  // Client-side mock price simulation (moves every 2 seconds)
  const { prices: mockPrices, lastUpdate, addPriceUpdates } = useOptimizedPriceUpdates();

  // Fetch initial prices from database on mount
  useEffect(() => {
    const fetchInitialPrices = async () => {
      const { data } = await supabase.from('assets').select('symbol, price, change_24h');
      if (data && data.length > 0) {
        const updates = data.map(asset => ({
          symbol: asset.symbol,
          price: asset.price || 0,
          change_24h: asset.change_24h || 0,
          timestamp: Date.now(),
        }));
        addPriceUpdates(updates);
      }
    };
    fetchInitialPrices();
  }, [addPriceUpdates]);

  // When real prices arrive from server, feed them into mock generator
  useEffect(() => {
    if (serverPrices.size > 0) {
      addPriceUpdates(Array.from(serverPrices.values()));
    }
  }, [serverPrices, addPriceUpdates]);

  const value: PriceContextType = {
    prices: mockPrices, // USE MOCK PRICES THAT MOVE EVERY 2 SECONDS
    isConnected,
    lastUpdate,
    connectionStatus,
    isUserActive,
    connectionMode,
  };

  return (
    <PriceContext.Provider value={value}>
      {children}
    </PriceContext.Provider>
  );
};