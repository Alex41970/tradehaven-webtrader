import { useState, useEffect, useRef } from 'react';
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

export const useRealtimePnL = (trades: Trade[]) => {
  const { prices } = useRealTimePrices();
  const [lastPnL, setLastPnL] = useState<Record<string, number>>({});
  const [pnLUpdatedAt, setPnLUpdatedAt] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate P&L every 500ms for smooth updates
  useEffect(() => {
    const calculatePnL = () => {
      const newPnL: Record<string, number> = {};
      let hasChanges = false;
      let priceUpdateCount = 0;

      trades.forEach(trade => {
        if (trade.status === 'closed') {
          newPnL[trade.id] = trade.pnl;
          return;
        }

        // Get current price from real-time prices
        const priceUpdate = prices.get(trade.symbol);
        const currentPrice = priceUpdate?.price;

        if (currentPrice && currentPrice > 0) {
          priceUpdateCount++;
          const realTimePnL = calculateRealTimePnL(
            {
              trade_type: trade.trade_type,
              amount: trade.amount,
              open_price: trade.open_price,
              leverage: trade.leverage
            },
            currentPrice
          );
          
          newPnL[trade.id] = realTimePnL;
          
          // Check if P&L has changed significantly (>$0.01)
          if (Math.abs((lastPnL[trade.id] || 0) - realTimePnL) > 0.01) {
            hasChanges = true;
          }
        } else {
          // Fall back to stored P&L if no real-time price
          newPnL[trade.id] = trade.pnl;
        }
      });

      // Only update state if there are significant changes
      if (hasChanges || Object.keys(lastPnL).length !== Object.keys(newPnL).length) {
        console.log('📊 P&L Updated:', Object.keys(newPnL).length, 'trades,', priceUpdateCount, 'with real-time prices');
        setLastPnL(newPnL);
        setPnLUpdatedAt(new Date());
      }
    };

    // Calculate immediately
    calculatePnL();

    // Set up interval for every 500ms updates (faster than before)
    intervalRef.current = setInterval(calculatePnL, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [trades, prices]); // Removed lastPnL from dependencies to prevent infinite loop

  // Calculate total P&L
  const totalPnL = Object.values(lastPnL).reduce((sum, pnl) => sum + pnl, 0);

  return {
    tradePnL: lastPnL,
    totalPnL,
    lastUpdated: pnLUpdatedAt
  };
};