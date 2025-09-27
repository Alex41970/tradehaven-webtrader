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

  // Batch updates every 100ms for responsive UI
  const processBatch = useCallback(() => {
    if (batchRef.current.length === 0) return;

    const updates = batchRef.current;
    batchRef.current = [];

    setPrices(prevPrices => {
      const newPrices = new Map(prevPrices);
      let actualUpdates = 0;

      updates.forEach(update => {
        const lastPrice = lastProcessedRef.current[update.symbol];
        // Allow all meaningful price changes (any change > 0 for pulsing)
        if (!lastPrice || update.price !== lastPrice) {
          newPrices.set(update.symbol, update);
          lastProcessedRef.current[update.symbol] = update.price;
          actualUpdates++;
        }
      });

      if (actualUpdates > 0) {
        console.log(`📊 Batched ${actualUpdates}/${updates.length} price updates`);
        setLastUpdate(new Date());
      }

      return newPrices;
    });
  }, []);

  // Add price update to batch
  const addPriceUpdate = useCallback((update: PriceUpdate) => {
    batchRef.current.push(update);

    // Clear existing timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    // Process batch after 100ms for responsive UI
    batchTimeoutRef.current = setTimeout(processBatch, 100);
  }, [processBatch]);

  // Add multiple price updates to batch
  const addPriceUpdates = useCallback((updates: PriceUpdate[]) => {
    batchRef.current.push(...updates);

    // Clear existing timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    // Process batch after 100ms for responsive UI
    batchTimeoutRef.current = setTimeout(processBatch, 100);
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