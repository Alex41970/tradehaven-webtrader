import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSharedUserProfile } from './useSharedUserProfile';
import { useTrades } from './useTrades';
import { useRealtimePnL } from './useRealtimePnL';
import { useAssets } from './useAssets';
import { computeAccountMetrics } from '@/utils/accountMetrics';

interface RealtimeAccountMetrics {
  // Real-time values
  realTimeBalance: number;
  /** Company money: usable for trading, never withdrawable */
  credit: number;
  /** Profit or loss of the positions that are still open */
  openPnL: number;
  realTimeEquity: number;
  realTimeFreeMargin: number;
  totalUsedMargin: number;
  /** Percent; null when nothing is open */
  marginLevel: number | null;
  /** Own money that can leave the account right now (credit excluded) */
  withdrawable: number;

  // Update indicators
  lastUpdated: Date | null;
  isUpdating: boolean;

  // Trade closing management
  excludeTradeFromPnL: (tradeId: string) => void;
  includeTradeInPnL: (tradeId: string) => void;

  // Trade opening validation
  canOpenTrade: (requiredMargin: number) => boolean;
}

export const useRealtimeAccountMetrics = (): RealtimeAccountMetrics => {
  const { profile } = useSharedUserProfile(true);
  const { openTrades } = useTrades();
  const { assets } = useAssets();

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [excludedTradeIds, setExcludedTradeIds] = useState<string[]>([]);

  const { totalPnL, lastUpdated: pnlLastUpdated } = useRealtimePnL(openTrades || [], assets || [], excludedTradeIds);

  // Trade exclusion management functions
  const excludeTradeFromPnL = (tradeId: string) => {
    setExcludedTradeIds(prev => [...prev, tradeId]);
  };

  const includeTradeInPnL = (tradeId: string) => {
    setExcludedTradeIds(prev => prev.filter(id => id !== tradeId));
  };

  // Equity = balance + credit + open P&L; free margin = equity - margin in use
  const metrics = useMemo(() => {
    const realTimeBalance = Number(profile?.balance) || 0;
    const credit = Number(profile?.credit) || 0;
    const openPnL = Number(totalPnL) || 0;
    const totalUsedMargin = (openTrades || []).reduce((sum, trade) => sum + (Number(trade.margin_used) || 0), 0);
    const m = computeAccountMetrics({ balance: realTimeBalance, credit, usedMargin: totalUsedMargin, openPnL });

    return {
      realTimeBalance,
      credit,
      openPnL,
      realTimeEquity: m.equity,
      realTimeFreeMargin: m.freeMargin,
      totalUsedMargin,
      marginLevel: m.marginLevel,
      withdrawable: m.withdrawable,
    };
  }, [profile?.balance, profile?.credit, totalPnL, openTrades]);

  // Validate if user can open a new trade
  const canOpenTrade = useCallback((requiredMargin: number): boolean => {
    return metrics.realTimeFreeMargin >= requiredMargin;
  }, [metrics.realTimeFreeMargin]);

  // Update timestamps and indicators when values change
  useEffect(() => {
    if (pnlLastUpdated) {
      setIsUpdating(true);
      setLastUpdated(pnlLastUpdated);

      // Clear updating indicator after short delay for visual feedback
      const timeout = setTimeout(() => {
        setIsUpdating(false);
      }, 200);

      return () => clearTimeout(timeout);
    }
  }, [pnlLastUpdated, metrics.realTimeBalance, metrics.realTimeEquity]);

  return {
    ...metrics,
    lastUpdated,
    isUpdating,
    excludeTradeFromPnL,
    includeTradeInPnL,
    canOpenTrade,
  };
};
