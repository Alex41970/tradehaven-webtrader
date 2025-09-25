import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";
import { useRealTimeTrading } from './useRealTimeTrading';
import { useRealtimeUserProfile } from './useRealtimeData';
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
  
  // Subscribe to DB realtime updates as fallback
  useRealtimeUserProfile(user?.id);
  
  // Merge WebSocket and DB profile data - freshest wins
  const profile = useMemo(() => {
    if (!isConnected || !realtimeProfile) {
      console.log('👤 Using DB profile only');
      return dbProfile;
    }
    
    if (!dbProfile) {
      console.log('👤 Using WebSocket profile only');
      return realtimeProfile as UserProfile;
    }
    
    // Use WebSocket as primary, but merge any missing fields from DB
    const merged = {
      ...dbProfile,
      ...(realtimeProfile as UserProfile),
      // Ensure we preserve all fields that might be missing from WebSocket
      updated_at: new Date().toISOString()
    };
    
    console.log('👤 Merged profile:', {
      hasDb: !!dbProfile,
      hasWs: !!realtimeProfile,
      isConnected,
      balance: merged.balance,
      equity: merged.equity || 'undefined'
    });
    
    return merged;
  }, [isConnected, realtimeProfile, dbProfile]);
  
  const loading = realtimeLoading || dbLoading;

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

  // Subscribe to DB realtime updates for profile as fallback
  useEffect(() => {
    const onProfileUpdated = (e: any) => {
      const updated = e.detail as Partial<UserProfile> | undefined;
      if (updated && (updated as any).user_id) {
        setDbProfile(prev => {
          if (!prev) return updated as UserProfile;
          if (prev.user_id === (updated as any).user_id) {
            return { ...prev, ...(updated as any) } as UserProfile;
          }
          return prev;
        });
      }
    };
    window.addEventListener('profile_updated', onProfileUpdated as EventListener);
    return () => {
      window.removeEventListener('profile_updated', onProfileUpdated as EventListener);
    };
  }, []);

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