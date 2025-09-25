import { useState, useEffect, useMemo } from 'react';
import { useUserProfile } from './useUserProfile';
import { useTrades } from './useTrades';
import { useRealtimePnL } from './useRealtimePnL';
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
}

export const useRealtimeAccountMetrics = (): RealtimeAccountMetrics => {
  const { profile } = useUserProfile();
  const { openTrades } = useTrades();
  const { assets } = useAssets();
  
  // Stabilize openTrades dependency to prevent unnecessary re-calculations
  const memoizedOpenTrades = useMemo(() => {
    if (!openTrades) return [];
    return openTrades;
  }, [openTrades?.length]);
  
  const { totalPnL, lastUpdated: pnlLastUpdated } = useRealtimePnL(memoizedOpenTrades, assets);
  
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Calculate real-time values
  const metrics = useMemo(() => {
    const accountBalance = profile?.balance || 0;
    
    // Calculate used margin from all open trades
    const totalUsedMargin = memoizedOpenTrades.reduce((sum, trade) => {
      return sum + (trade.margin_used || 0);
    }, 0);

    // Balance is static (closed P&L only) - from closed trades only
    const realTimeBalance = accountBalance;
    
    // Equity = Balance + Unrealized P&L from open trades
    const realTimeEquity = accountBalance + totalPnL;
    
    // Free margin = equity - used margin
    const realTimeFreeMargin = Math.max(0, realTimeEquity - totalUsedMargin);

    return {
      realTimeBalance,
      realTimeEquity,
      realTimeFreeMargin,
      totalUsedMargin,
    };
  }, [profile?.balance, totalPnL, memoizedOpenTrades]);

  // Update timestamps and indicators when values change (debounced)
  useEffect(() => {
    if (pnlLastUpdated) {
      setIsUpdating(true);
      setLastUpdated(pnlLastUpdated);
      
      // Clear updating indicator after short delay for visual feedback
      const timeout = setTimeout(() => {
        setIsUpdating(false);
      }, 300);
      
      return () => clearTimeout(timeout);
    }
  }, [pnlLastUpdated]);

  return {
    ...metrics,
    lastUpdated,
    isUpdating,
  };
};