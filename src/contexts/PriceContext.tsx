import React, { createContext, useContext, useEffect } from 'react';
import { useSmartPriceSubscription } from '@/hooks/useSmartPriceSubscription';
import { useOptimizedPriceUpdates } from '@/hooks/useOptimizedPriceUpdates';
import { useTradingSettings, PriceIntensity } from '@/hooks/useTradingSettings';
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
  // Trading settings from admin
  isMarketClosed: boolean;
  canTrade: boolean;
  priceIntensity: PriceIntensity;
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
  // Get trading settings from user's admin
  const { priceIntensity, isMarketClosed, canTrade } = useTradingSettings();

  // Presence tracking only - NO price broadcast channel (saves Realtime costs)
  const {
    isConnected,
    connectionStatus,
    isUserActive,
  } = useSmartPriceSubscription();

  // Client-side mock price simulation with admin-controlled intensity
  const { prices: mockPrices, lastUpdate, addPriceUpdates } = useOptimizedPriceUpdates({
    intensity: priceIntensity,
    isMarketClosed,
  });

  // Fetch initial prices from database on mount (replaces broadcast channel)
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

  const value: PriceContextType = {
    prices: mockPrices,
    isConnected,
    lastUpdate,
    connectionStatus,
    isUserActive,
    connectionMode: 'polling', // Always polling mode now (no WebSocket broadcasts)
    // Expose trading settings
    isMarketClosed,
    canTrade,
    priceIntensity,
  };

  return (
    <PriceContext.Provider value={value}>
      {children}
    </PriceContext.Provider>
  );
};
