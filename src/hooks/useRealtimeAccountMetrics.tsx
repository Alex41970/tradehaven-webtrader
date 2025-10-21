import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSharedUserProfile } from './useSharedUserProfile';
import { useTrades } from './useTrades';
import { useRealtimePnL } from './useRealtimePnL';
import { useEventDrivenUpdates } from './useEventDrivenUpdates';
import { useAssets } from './useAssets';

interface RealtimeAccountMetrics {
  // Real-time values
  realTimeBalance: number;
  realTimeEquity: number;
  realTimeFreeMargin: number;
  totalUsedMargin: number;
  
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
  const { profile, lastUpdate } = useSharedUserProfile(true);
  const { openTrades } = useTrades();
  const { assets } = useAssets();
  
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [excludedTradeIds, setExcludedTradeIds] = useState<string[]>([]);
  
  const { totalPnL, lastUpdated: pnlLastUpdated } = useRealtimePnL(openTrades || [], assets || [], excludedTradeIds);
  const { handleTradeAction } = useEventDrivenUpdates();

  // Trade exclusion management functions
  const excludeTradeFromPnL = (tradeId: string) => {
    setExcludedTradeIds(prev => [...prev, tradeId]);
  };
  
  const includeTradeInPnL = (tradeId: string) => {
    setExcludedTradeIds(prev => prev.filter(id => id !== tradeId));
  };

  // Calculate real-time values
  const metrics = useMemo(() => {
    const accountBalance = profile?.balance ?? 0;
    
    // Calculate used margin from all open trades
    const totalUsedMargin = (openTrades || []).reduce((sum, trade) => {
      return sum + (trade.margin_used || 0);
    }, 0);

    // Balance is static (closed P&L only) - backend ensures this
    const realTimeBalance = accountBalance;
    
    // Equity = Balance + Unrealized P&L from open trades
    // Backend sends balance without unrealized P&L, we add it here
    const realTimeEquity = accountBalance + totalPnL;
    
    // Free margin = equity - used margin
    const realTimeFreeMargin = Math.max(0, realTimeEquity - totalUsedMargin);

    return {
      realTimeBalance,
      realTimeEquity,
      realTimeFreeMargin,
      totalUsedMargin,
    };
  }, [profile?.balance, totalPnL, openTrades]);

  // Validate if user can open a new trade
  const canOpenTrade = useCallback((requiredMargin: number): boolean => {
    const availableMargin = Math.max(0, metrics.realTimeEquity - metrics.totalUsedMargin);
    return availableMargin >= requiredMargin;
  }, [metrics.realTimeEquity, metrics.totalUsedMargin]);

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