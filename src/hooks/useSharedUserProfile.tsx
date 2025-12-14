import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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

// Singleton state shared across all hook instances
let sharedProfile: UserProfile | null = null;
let sharedLoading = true;
let sharedLastFetch = 0;
let isInitialLoad = true;
let subscribers = new Set<() => void>();
let fetchPromise: Promise<UserProfile | null> | null = null;

// Cost-optimized polling intervals
const CACHE_DURATION = 30000; // 30 second cache (was 5s)
const ACTIVE_POLL_INTERVAL = 30000; // 30 seconds when trades active (was 5s) - 83% cost reduction
const IDLE_POLL_INTERVAL = 60000; // 60 seconds when idle (was 30s) - 50% cost reduction

export const useSharedUserProfile = (hasActiveTrades = false) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(sharedProfile);
  const [loading, setLoading] = useState(sharedLoading);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Notify all subscribers of state change
  const notifySubscribers = useCallback(() => {
    subscribers.forEach(callback => callback());
  }, []);

  // Fetch profile with request deduplication
  const fetchProfile = useCallback(async (forceRefresh = false): Promise<UserProfile | null> => {
    if (!user) {
      sharedProfile = null;
      sharedLoading = false;
      isInitialLoad = true; // Reset for next user
      notifySubscribers();
      return null;
    }

    const now = Date.now();
    
    // Return cached data if still fresh and not forcing refresh
    if (!forceRefresh && sharedProfile && (now - sharedLastFetch) < CACHE_DURATION) {
      return sharedProfile;
    }

    // If fetch already in progress, return existing promise
    if (fetchPromise) {
      return fetchPromise;
    }

    // Create new fetch promise
    fetchPromise = (async () => {
      try {
        // Only show loading on initial fetch, not on polling refreshes
        if (isInitialLoad) {
          sharedLoading = true;
          notifySubscribers();
        }

        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        sharedProfile = data;
        sharedLastFetch = Date.now();
        sharedLoading = false;
        isInitialLoad = false; // Mark that initial load is complete
        
        notifySubscribers();
        return data;
      } catch (error) {
        console.error('Error fetching profile:', error);
        sharedLoading = false;
        notifySubscribers();
        return null;
      } finally {
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  }, [user, notifySubscribers]);

  // Set up polling based on activity
  useEffect(() => {
    if (!user) return;

    const pollInterval = hasActiveTrades ? ACTIVE_POLL_INTERVAL : IDLE_POLL_INTERVAL;

    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Initial fetch
    fetchProfile();

    // Set up polling (silent in production)
    pollIntervalRef.current = setInterval(() => {
      fetchProfile(true);
    }, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [user, hasActiveTrades, fetchProfile]);

  // Subscribe to shared state changes
  useEffect(() => {
    const updateState = () => {
      setProfile(sharedProfile);
      setLoading(sharedLoading);
    };

    subscribers.add(updateState);

    return () => {
      subscribers.delete(updateState);
    };
  }, []);

  // Removed realtime subscription - polling is sufficient and reduces costs
  // Prices already update via PriceContext, profile updates via polling every 30-60s

  const forceRefresh = useCallback(async () => {
    return await fetchProfile(true);
  }, [fetchProfile]);

  return {
    profile,
    loading,
    refetch: forceRefresh,
    forceRefresh,
    lastUpdate: new Date(sharedLastFetch),
  };
};
