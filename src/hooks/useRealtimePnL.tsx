import { useState, useEffect, useRef, useCallback } from 'react';
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
}

export const useRealtimePnL = (trades: Trade[], assets: Asset[] = []) => {
  const { prices } = useRealTimePrices();
  const [lastPnL, setLastPnL] = useState<Record<string, number>>({});
  const [pnLUpdatedAt, setPnLUpdatedAt] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPricesRef = useRef<Record<string, number>>({});
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Circuit breaker: only calculate if there are open trades
  const openTrades = trades.filter(trade => trade.status === 'open');
  const hasOpenTrades = openTrades.length > 0;

  const calculatePnL = useCallback(() => {
    // Circuit breaker: don't calculate if no open trades
    if (!hasOpenTrades) {
      return;
    }

    const newPnL: Record<string, number> = {};
    const newPrices: Record<string, number> = {};
    let hasSignificantChange = false;

    trades.forEach(trade => {
      if (trade.status === 'closed') {
        newPnL[trade.id] = trade.pnl;
        return;
      }

      // Get current price from real-time prices
      const priceUpdate = prices.get(trade.symbol);
      const currentPrice = Number(priceUpdate?.price);

      if (currentPrice && currentPrice > 0) {
        // Track price changes with higher threshold to reduce noise
        const previousPrice = lastPricesRef.current[trade.symbol];
        if (!previousPrice || Math.abs(currentPrice - previousPrice) >= 0.01) {
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
        // Fall back to stored P&L if no real-time price
        newPnL[trade.id] = trade.pnl;
      }
    });

    // Update price tracking
    lastPricesRef.current = newPrices;

    // Only update state if there are significant changes
    const hasPnLChange = Object.keys(newPnL).some(tradeId => 
      Math.abs((newPnL[tradeId] || 0) - (lastPnL[tradeId] || 0)) >= 0.1
    );
    
    if (hasSignificantChange || hasPnLChange) {
      // Debounce state updates to prevent excessive re-renders
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      debounceTimeoutRef.current = setTimeout(() => {
        setLastPnL(newPnL);
        setPnLUpdatedAt(new Date());
        console.log('📊 P&L Updated:', Object.keys(newPnL).length, 'trades');
      }, 100); // 100ms debounce
    }
  }, [trades, prices, assets, hasOpenTrades, lastPnL]);

  // Optimized update frequency: 2 seconds instead of 250ms
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

    // Set up interval for every 2 seconds (much more efficient)
    intervalRef.current = setInterval(calculatePnL, 2000);

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

  // Calculate total P&L
  const totalPnL = Object.values(lastPnL).reduce((sum, pnl) => sum + pnl, 0);

  return {
    tradePnL: lastPnL,
    totalPnL,
    lastUpdated: pnLUpdatedAt
  };
};