import { useState, useEffect, useRef, useMemo } from 'react';
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
  const [lastPrices, setLastPrices] = useState<Record<string, number>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize trades and assets to prevent unnecessary recalculations
  const memoizedTrades = useMemo(() => trades, [trades.length, trades.map(t => `${t.id}-${t.symbol}-${t.status}`).join(',')]);
  const memoizedAssets = useMemo(() => assets, [assets.length, assets.map(a => a.symbol).join(',')]);

  // Calculate P&L every 500ms for responsive updates (reduced from 250ms)
  useEffect(() => {
    const calculatePnL = () => {
      const newPnL: Record<string, number> = {};
      const newPrices: Record<string, number> = {};
      let priceUpdateCount = 0;
      let hasAnyPriceChange = false;

      memoizedTrades.forEach(trade => {
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

          // Find asset for contract_size (important for forex)
          const asset = memoizedAssets.find(a => a.symbol === trade.symbol);
          const contractSize = asset?.contract_size || 1;
          
          // Calculate with higher precision for micro-changes
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
          
          // Round to 4 decimal places for precision
          newPnL[trade.id] = Math.round(realTimePnL * 10000) / 10000;
        } else {
          // Fall back to stored P&L if no real-time price
          newPnL[trade.id] = trade.pnl;
        }
      });

      // Update prices tracking
      setLastPrices(newPrices);

      // Only update state if there are meaningful changes (increased threshold for performance)
      const hasSignificantChange = Object.keys(newPnL).some(tradeId => 
        Math.abs((newPnL[tradeId] || 0) - (lastPnL[tradeId] || 0)) >= 0.10
      );
      
      if (hasAnyPriceChange || hasSignificantChange) {
        setLastPnL(newPnL);
        setPnLUpdatedAt(new Date());
      }
    };

    // Calculate immediately
    calculatePnL();

    // Set up interval for every 500ms updates (optimized for performance)
    intervalRef.current = setInterval(calculatePnL, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [memoizedTrades, prices, memoizedAssets]);

  // Calculate total P&L
  const totalPnL = Object.values(lastPnL).reduce((sum, pnl) => sum + pnl, 0);

  return {
    tradePnL: lastPnL,
    totalPnL,
    lastUpdated: pnLUpdatedAt
  };
};