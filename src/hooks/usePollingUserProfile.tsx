import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

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

interface UsePollingUserProfileOptions {
  pollingInterval?: number; // milliseconds
  enablePolling?: boolean;
}

export const usePollingUserProfile = (options: UsePollingUserProfileOptions = {}) => {
  const { pollingInterval = 20000, enablePolling = true } = options; // Default 20 seconds
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);
  const lastUpdateRef = useRef<Date>(new Date());

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return null;
    }

    try {
      console.log('🔄 Fetching user profile via HTTP...');
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      lastUpdateRef.current = new Date();
      
      console.log('✅ Profile updated via HTTP:', {
        balance: data.balance,
        equity: data.equity,
        usedMargin: data.used_margin,
        availableMargin: data.available_margin
      });
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Force immediate refresh (for after user actions)
  const forceRefresh = useCallback(async () => {
    console.log('🚀 Force refreshing profile...');
    return await fetchProfile();
  }, [fetchProfile]);

  // Setup visibility change listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      console.log('👁️ Tab visibility changed:', isVisibleRef.current ? 'visible' : 'hidden');
      
      if (isVisibleRef.current && enablePolling) {
        // Resume polling when tab becomes visible
        startPolling();
      } else {
        // Pause polling when tab is hidden
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enablePolling]);

  // Start polling function
  const startPolling = useCallback(() => {
    if (!enablePolling || !user || pollIntervalRef.current) return;

    console.log(`⏰ Starting profile polling (${pollingInterval / 1000}s interval)`);
    setIsPolling(true);

    pollIntervalRef.current = setInterval(() => {
      if (isVisibleRef.current) {
        fetchProfile();
      }
    }, pollingInterval);
  }, [enablePolling, user, pollingInterval, fetchProfile]);

  // Stop polling function
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      console.log('⏹️ Stopping profile polling');
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      setIsPolling(false);
    }
  }, []);

  // Initial load and polling setup
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchProfile();

    // Start polling if enabled and tab is visible
    if (enablePolling && isVisibleRef.current) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [user, enablePolling, startPolling, stopPolling, fetchProfile]);

  // Legacy compatibility functions
  const updateBalance = async (newBalance: number, newEquity: number, newUsedMargin: number, newAvailableMargin: number) => {
    console.log('updateBalance called - triggering immediate refresh');
    await forceRefresh();
    return true;
  };

  const recalculateMargins = useCallback(async () => {
    console.log('recalculateMargins called - triggering immediate refresh');
    await forceRefresh();
    return true;
  }, [forceRefresh]);

  return {
    profile,
    loading,
    isPolling,
    lastUpdate: lastUpdateRef.current,
    refetch: fetchProfile,
    forceRefresh,
    updateBalance,
    recalculateMargins,
    startPolling,
    stopPolling,
  };
};