import { useMemo } from 'react';
import { useRealTimePrices } from './useRealTimePrices';
import { calculateRealTimePnL } from '@/utils/pnlCalculator';

interface PnLTrade {
  id: string;
  symbol: string;
  trade_type: 'BUY' | 'SELL';
  amount: number;
  leverage: number;
  open_price: number;
  status: 'open' | 'closed';
  pnl: number;
}

interface PnLAsset {
  symbol: string;
  contract_size?: number | null;
  price?: number;
}

/**
 * Live profit and loss of the open positions. It is worked out from the trade list and
 * the current prices on every render and keeps nothing in memory, so a position that
 * has just been closed stops counting in the very same step.
 */
export const useRealtimePnL = (trades: PnLTrade[], assets: PnLAsset[] = []) => {
  const { prices } = useRealTimePrices();

  return useMemo(() => {
    const tradePnL: Record<string, number> = {};
    let totalPnL = 0;
    let count = 0;

    for (const trade of trades) {
      if (trade.status !== 'open') continue;
      const asset = assets.find((a) => a.symbol === trade.symbol);
      const live = Number(prices.get(trade.symbol)?.price);
      const price = live > 0 ? live : Number(asset?.price);
      // Without any price, fall back to the figure the server last stored
      const pnl = price > 0
        ? Math.round(calculateRealTimePnL(trade, price, Number(asset?.contract_size) || undefined) * 100) / 100
        : Number(trade.pnl) || 0;
      tradePnL[trade.id] = pnl;
      totalPnL += pnl;
      count++;
    }

    return { tradePnL, totalPnL, lastUpdated: count ? new Date() : null };
  }, [trades, assets, prices]);
};
