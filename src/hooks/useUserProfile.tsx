import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";
import { useRealTimeTrading } from './useRealTimeTrading';
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

export const useUserProfile = () => {
  const { user } = useAuth();
  const [dbProfile, setDbProfile] = useState<UserProfile | null>(null);
  const [dbLoading, setDbLoading] = useState(true);
  
  const { profile: realtimeProfile, loading: realtimeLoading, isConnected } = useRealTimeTrading();
  
  // Use real-time data if connected, fallback to database data
  const profile = (isConnected && realtimeProfile) ? realtimeProfile as UserProfile : dbProfile;
  const loading = isConnected ? realtimeLoading : dbLoading;

  // Fallback database fetch
  const fetchProfile = useCallback(async () => {
    if (!user) {
      setDbLoading(false);
      return;
    }

    try {
      setDbLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setDbProfile(data);
    } catch (error) {
      console.error('Error fetching user profile from database:', error);
      setDbProfile(null);
    } finally {
      setDbLoading(false);
    }
  }, [user]);

  // Initial database load
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Force refresh function (no longer needed with real-time)
  const forceRefresh = useCallback(async () => {
    console.log('forceRefresh called - now using real-time data');
  }, []);

  // Update balance function (no longer needed with real-time)
  const updateBalance = async (newBalance: number, newEquity: number, newUsedMargin: number, newAvailableMargin: number) => {
    console.log('updateBalance called - now handled by real-time WebSocket');
    return true;
  };

  // Recalculate margins function (no longer needed with real-time)
  const recalculateMargins = useCallback(async () => {
    console.log('recalculateMargins called - now handled by real-time WebSocket');
    return true;
  }, []);

  // No longer needed with real-time WebSocket system

  return {
    profile,
    loading,
    refetch: fetchProfile,
    forceRefresh,
    updateBalance,
    recalculateMargins,
  };
};