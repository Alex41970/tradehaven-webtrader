import { useEffect, useCallback } from 'react';
import { useUserProfile } from './useUserProfile';
import { useRealTimeTrading } from './useRealTimeTrading';

/**
 * Hook to handle event-driven updates after user actions
 * Provides immediate feedback while using polling for regular updates
 */
export const useEventDrivenUpdates = () => {
  const { forceRefresh: refreshProfile } = useUserProfile();
  const { isConnected } = useRealTimeTrading();

  // Trigger immediate update after trade actions
  const handleTradeAction = useCallback(async (action: 'open' | 'close', tradeDetails?: any) => {
    console.log(`🎯 Trade ${action} detected - triggering immediate profile refresh`);
    
    // Small delay to ensure backend has processed the trade
    setTimeout(async () => {
      await refreshProfile();
    }, 500);
  }, [refreshProfile]);

  // Trigger immediate update after balance modifications
  const handleBalanceModification = useCallback(async (action: 'deposit' | 'withdrawal' | 'admin_adjustment') => {
    console.log(`💰 Balance ${action} detected - triggering immediate profile refresh`);
    
    // Immediate refresh for balance changes
    await refreshProfile();
  }, [refreshProfile]);

  // Auto-refresh when WebSocket reconnects (to sync any missed updates)
  useEffect(() => {
    if (isConnected) {
      console.log('🔌 Trading WebSocket reconnected - syncing profile data');
      refreshProfile();
    }
  }, [isConnected, refreshProfile]);

  return {
    handleTradeAction,
    handleBalanceModification,
    refreshProfile,
  };
};