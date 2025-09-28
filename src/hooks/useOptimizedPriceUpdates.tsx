import { useState, useEffect, useRef, useCallback } from 'react';

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
}

interface BatchedPriceUpdate {
  updates: PriceUpdate[];
  timestamp: number;
}

/**
 * Hook for batching and deduplicating price updates to reduce re-renders
 */
export const useOptimizedPriceUpdates = () => {
  const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const batchRef = useRef<PriceUpdate[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedRef = useRef<Record<string, number>>({});

  // IMMEDIATE processing for AllTick - no batching delay
  const processBatch = useCallback(() => {
    if (batchRef.current.length === 0) return;

    const updates = batchRef.current;
    batchRef.current = [];

    setPrices(prevPrices => {
      const newPrices = new Map(prevPrices);
      let actualUpdates = 0;

      updates.forEach(update => {
        // Process ALL price updates immediately - AllTick direct feed
        newPrices.set(update.symbol, update);
        lastProcessedRef.current[update.symbol] = update.price;
        actualUpdates++;
        console.log(`⚡ INSTANT UPDATE: ${update.symbol} = $${update.price} - NO DELAY`);
      });

      if (actualUpdates > 0) {
        console.log(`🔥 INSTANT PROCESSED ${actualUpdates} ticks - ZERO BATCHING`);
        setLastUpdate(new Date());
      }

      return newPrices;
    });
  }, []);

  // Add price update and process IMMEDIATELY - no delay
  const addPriceUpdate = useCallback((update: PriceUpdate) => {
    batchRef.current.push(update);

    // Clear any existing timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    // Process IMMEDIATELY - no timeout delay for AllTick
    processBatch();
  }, [processBatch]);

  // Add multiple price updates and process IMMEDIATELY
  const addPriceUpdates = useCallback((updates: PriceUpdate[]) => {
    batchRef.current.push(...updates);

    // Clear any existing timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    // Process IMMEDIATELY - no timeout delay for bulk updates
    processBatch();
  }, [processBatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  return {
    prices,
    lastUpdate,
    addPriceUpdate,
    addPriceUpdates,
    processBatch, // Expose for manual processing if needed
  };
};