import React, { createContext, useContext, useEffect, useState } from 'react';
import { useOptimizedPriceUpdates } from '@/hooks/useOptimizedPriceUpdates';
import { logger } from '@/utils/logger';

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
  logger.debug('🔥 PRICE PROVIDER COMPONENT CREATED - INITIALIZING NOW');
  
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

  // Price service will be implemented with Twelve Data WebSocket
  useEffect(() => {
    logger.debug('🔥 PRICE PROVIDER - Awaiting Twelve Data implementation');
    
    // TODO: Initialize Twelve Data WebSocket connection
    // Will be implemented after API key is provided
    
    setConnectionStatus('disconnected');
    setIsConnected(false);
    
    return () => {
      logger.debug('🔌 PriceProvider: Cleanup (no active connections)');
    };
  }, []);

  // Handle page visibility for performance
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logger.debug('🔇 Page hidden - marking as paused');
        setIsPaused(true);
      } else {
        logger.debug('🔊 Page visible - resuming');
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