import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRealTimePrices } from './useRealTimePrices';
import { calculateRealTimePnL } from '@/utils/pnlCalculator';

interface Trade {
  id: string;
  symbol: string;
  trade_type: 'BUY' | 'SELL';
  amount: number;
  leverage: number;
  open_price: number;
  status: 'open' | 'closed';
  pnl: number;
}

interface Asset {
  symbol: string;
  contract_size: number;
  category: string;
  price?: number;
}

export const useRealtimePnL = (trades: Trade[], assets: Asset[] = [], excludeTradeIds: string[] = []) => {
  const { prices } = useRealTimePrices();
  const [lastPnL, setLastPnL] = useState<Record<string, number>>({});
  const [pnLUpdatedAt, setPnLUpdatedAt] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPricesRef = useRef<Record<string, number>>({});
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize open trades excluding any that are being closed
  const openTrades = useMemo(() => 
    trades.filter(trade => trade.status === 'open' && !excludeTradeIds.includes(trade.id)), 
    [trades, excludeTradeIds]
  );
  const hasOpenTrades = openTrades.length > 0;

  const calculatePnL = useCallback(() => {
    // Circuit breaker: don't calculate if no open trades
    if (!hasOpenTrades) {
      // Clear PnL for any excluded trades
      if (excludeTradeIds.length > 0) {
        const filteredPnL = { ...lastPnL };
        excludeTradeIds.forEach(tradeId => {
          delete filteredPnL[tradeId];
        });
        if (Object.keys(filteredPnL).length !== Object.keys(lastPnL).length) {
          setLastPnL(filteredPnL);
          setPnLUpdatedAt(new Date());
        }
      }
      return;
    }

    const newPnL: Record<string, number> = {};
    const newPrices: Record<string, number> = {};
    let hasSignificantChange = false;

    // Only process open trades for performance
    openTrades.forEach(trade => {
      // Skip excluded trades
      if (excludeTradeIds.includes(trade.id)) {
        return;
      }

      // Get current price from real-time prices
      const priceUpdate = prices.get(trade.symbol);
      const currentPrice = Number(priceUpdate?.price);

      if (currentPrice && currentPrice > 0) {
        // Track all price changes for real-time updates
        const previousPrice = lastPricesRef.current[trade.symbol];
        if (!previousPrice || currentPrice !== previousPrice) {
          hasSignificantChange = true;
        }
        newPrices[trade.symbol] = currentPrice;

        // Find asset for contract_size
        const asset = assets.find(a => a.symbol === trade.symbol);
        const contractSize = asset?.contract_size || 1;
        
        // Calculate real-time P&L
        const realTimePnL = calculateRealTimePnL(
          {
            trade_type: trade.trade_type,
            amount: trade.amount,
            open_price: trade.open_price,
            leverage: trade.leverage,
            contract_size: contractSize
          },
          currentPrice,
          contractSize
        );
        
        // Round to 2 decimal places for display
        newPnL[trade.id] = Math.round(realTimePnL * 100) / 100;
      } else {
        // Fallback: Try to get price from assets array
        const asset = assets.find(a => a.symbol === trade.symbol);
        const fallbackPrice = asset?.price;
        
        if (fallbackPrice && fallbackPrice > 0) {
          newPrices[trade.symbol] = fallbackPrice;
          hasSignificantChange = true;
          
          const contractSize = asset?.contract_size || 1;
          const realTimePnL = calculateRealTimePnL(
            {
              trade_type: trade.trade_type,
              amount: trade.amount,
              open_price: trade.open_price,
              leverage: trade.leverage,
              contract_size: contractSize
            },
            fallbackPrice,
            contractSize
          );
          
          newPnL[trade.id] = Math.round(realTimePnL * 100) / 100;
        } else {
          // Last resort: Fall back to stored P&L if no price available
          console.warn(`⚠️ No price available for ${trade.symbol}, using stored PnL`);
          newPnL[trade.id] = trade.pnl;
        }
      }
    });

    // Update price tracking
    lastPricesRef.current = newPrices;

    // Update state on any change for real-time responsiveness
    const hasPnLChange = Object.keys(newPnL).some(tradeId => 
      (newPnL[tradeId] || 0) !== (lastPnL[tradeId] || 0)
    );
    
    // Also check if we need to remove excluded trades
    const hasExcludedTrades = excludeTradeIds.some(tradeId => tradeId in lastPnL);
    
    if (hasSignificantChange || hasPnLChange || hasExcludedTrades) {
      setLastPnL(newPnL);
      setPnLUpdatedAt(new Date());
    }
  }, [openTrades, prices, assets, hasOpenTrades, lastPnL, excludeTradeIds]);

  // Real-time update frequency: 1 second for responsive updates
  useEffect(() => {
    // Don't start interval if no open trades
    if (!hasOpenTrades) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Calculate immediately for open trades
    calculatePnL();

    // Set up interval for every 1 second for responsive updates
    intervalRef.current = setInterval(calculatePnL, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [calculatePnL, hasOpenTrades]);

  // Memoize total P&L calculation
  const totalPnL = useMemo(() => 
    Object.values(lastPnL).reduce((sum, pnl) => sum + pnl, 0), 
    [lastPnL]
  );

  return {
    tradePnL: lastPnL,
    totalPnL,
    lastUpdated: pnLUpdatedAt
  };
};