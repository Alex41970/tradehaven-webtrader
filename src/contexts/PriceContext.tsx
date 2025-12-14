import React, { createContext, useContext } from 'react';
import { useSmartPriceSubscription } from '@/hooks/useSmartPriceSubscription';
import { logger } from '@/utils/logger';

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
  // Use the smart price subscription hook
  const {
    prices,
    isConnected,
    lastUpdate,
    connectionStatus,
    isUserActive,
    connectionMode,
  } = useSmartPriceSubscription();

  const value: PriceContextType = {
    prices,
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