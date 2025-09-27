import { usePollingUserProfile } from './usePollingUserProfile';
import { useRealTimeTrading } from './useRealTimeTrading';
import { useTrades } from './useTrades';

export interface UserProfile {
  id: string;
  user_id: string;
  email?: string;
  first_name?: string;
  surname?: string;
  phone_number?: string;
  balance: number;
  equity: number;
  used_margin: number;
  available_margin: number;
  created_at: string;
  updated_at: string;
}

export const useUserProfile = () => {
  // Get trading activity to determine polling frequency
  const { openTrades } = useTrades();
  const hasActiveTrades = openTrades.length > 0;

  // Use adaptive HTTP polling for profile data
  const pollingProfile = usePollingUserProfile({
    activePollingInterval: 5000,   // 5 seconds when trades are active
    idlePollingInterval: 30000,    // 30 seconds when no active trades
    enablePolling: true,
    hasActiveTrades
  });

  // Keep trading WebSocket for immediate trade confirmations only
  const { isConnected: isTradingConnected } = useRealTimeTrading();

  // Enhanced force refresh that works after user actions
  const enhancedForceRefresh = async () => {
    console.log('🚀 Enhanced force refresh triggered');
    return await pollingProfile.forceRefresh();
  };

  // Enhanced update balance with immediate refresh
  const enhancedUpdateBalance = async (newBalance: number, newEquity: number, newUsedMargin: number, newAvailableMargin: number) => {
    console.log('🔄 Balance update triggered - refreshing immediately');
    await pollingProfile.forceRefresh();
    return true;
  };

  // Enhanced recalculate margins with immediate refresh
  const enhancedRecalculateMargins = async () => {
    console.log('📊 Margin recalculation triggered - refreshing immediately');
    await pollingProfile.forceRefresh();
    return true;
  };

  return {
    profile: pollingProfile.profile,
    loading: pollingProfile.loading,
    isPolling: pollingProfile.isPolling,
    isTradingConnected,
    lastUpdate: pollingProfile.lastUpdate,
    refetch: pollingProfile.refetch,
    forceRefresh: enhancedForceRefresh,
    updateBalance: enhancedUpdateBalance,
    recalculateMargins: enhancedRecalculateMargins,
  };
};