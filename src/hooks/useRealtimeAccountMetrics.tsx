import { useState, useEffect, useMemo } from 'react';
import { useUserProfile } from './useUserProfile';
import { useTrades } from './useTrades';
import { useRealtimePnL } from './useRealtimePnL';

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
  const { totalPnL, lastUpdated: pnlLastUpdated } = useRealtimePnL(openTrades || [], []);
  
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Calculate real-time values
  const metrics = useMemo(() => {
    const accountBalance = profile?.balance ?? 0;
    
    // Calculate used margin from all open trades
    const totalUsedMargin = (openTrades || []).reduce((sum, trade) => {
      return sum + (trade.margin_used || 0);
    }, 0);

    // Balance is static (closed P&L only)
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
  }, [profile?.balance, totalPnL, openTrades]);

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
  };
};