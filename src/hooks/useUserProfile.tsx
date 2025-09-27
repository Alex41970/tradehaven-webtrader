import { usePollingUserProfile } from './usePollingUserProfile';
import { useRealTimeTrading } from './useRealTimeTrading';

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
  // Use HTTP polling for profile data (reduced real-time messages)
  const pollingProfile = usePollingUserProfile({
    pollingInterval: 20000, // 20 seconds - good balance for trading platform
    enablePolling: true
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