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
  const [lastPrices, setLastPrices] = useState<Record<string, number>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate P&L every 250ms for ultra-responsive updates
  useEffect(() => {
    const calculatePnL = () => {
      const newPnL: Record<string, number> = {};
      const newPrices: Record<string, number> = {};
      let priceUpdateCount = 0;
      let hasAnyPriceChange = false;

      trades.forEach(trade => {
        if (trade.status === 'closed') {
          newPnL[trade.id] = trade.pnl;
          return;
        }

        // Get current price from real-time prices
        const priceUpdate = prices.get(trade.symbol);
        const currentPrice = Number(priceUpdate?.price);

        if (currentPrice && currentPrice > 0) {
          priceUpdateCount++;
          
          // Track price changes for even tiny movements
          const previousPrice = lastPrices[trade.symbol];
          if (previousPrice && Math.abs(currentPrice - previousPrice) >= 0.001) {
            hasAnyPriceChange = true;
          }
          newPrices[trade.symbol] = currentPrice;

          // Calculate with higher precision for micro-changes
          const realTimePnL = calculateRealTimePnL(
            {
              trade_type: trade.trade_type,
              amount: trade.amount,
              open_price: trade.open_price,
              leverage: trade.leverage
            },
            currentPrice
          );
          
          // Round to 4 decimal places for precision
          newPnL[trade.id] = Math.round(realTimePnL * 10000) / 10000;
        } else {
          // Fall back to stored P&L if no real-time price
          newPnL[trade.id] = trade.pnl;
        }
      });

      // Update prices tracking
      setLastPrices(newPrices);

      // Always update state for ultra-responsive feedback
      setLastPnL(newPnL);
      setPnLUpdatedAt(new Date());

      if (hasAnyPriceChange) {
        console.log('📊 P&L Updated (price change detected):', Object.keys(newPnL).length, 'trades,', priceUpdateCount, 'with real-time prices');
      }
    };

    // Calculate immediately
    calculatePnL();

    // Set up interval for every 250ms updates (ultra-fast)
    intervalRef.current = setInterval(calculatePnL, 250);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [trades, prices, lastPrices]); // Include lastPrices for price change detection

  // Calculate total P&L
  const totalPnL = Object.values(lastPnL).reduce((sum, pnl) => sum + pnl, 0);

  return {
    tradePnL: lastPnL,
    totalPnL,
    lastUpdated: pnLUpdatedAt
  };
};