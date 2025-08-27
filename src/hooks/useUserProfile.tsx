import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";

export interface UserProfile {
  id: string;
  user_id: string;
  email?: string;
  balance: number;
  equity: number;
  used_margin: number;
  available_margin: number;
  created_at: string;
  updated_at: string;
}

export const useUserProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    try {
      console.log('Fetching profile for user:', user.id);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create one
          console.log('Profile not found, creating new profile for user:', user.id);
          const { data: newProfile, error: createError } = await supabase
            .from('user_profiles')
            .insert({
              user_id: user.id,
              email: user.email,
              balance: 10000.00,
              equity: 10000.00,
              available_margin: 10000.00,
              used_margin: 0.00
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError);
            toast({
              title: "Error",
              description: "Failed to create user profile",
              variant: "destructive",
            });
            return;
          }

          setProfile(newProfile);
          console.log('New profile created:', newProfile);
          toast({
            title: "Welcome!",
            description: "Your trading account has been created with $10,000 balance",
          });
        } else {
          console.error('Error fetching profile:', error);
          toast({
            title: "Error",
            description: "Failed to fetch profile data",
            variant: "destructive",
          });
        }
        return;
      }

      console.log('Profile fetched:', data);
      setProfile(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email]); // More specific dependencies

  useEffect(() => {
    if (user) {
      fetchProfile();
      
      // Set up real-time subscription for profile changes
      console.log('Setting up real-time subscription for user profile');
      const channel = supabase
        .channel(`user_profile_changes_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_profiles',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Real-time profile update:', payload);
            if (payload.new && typeof payload.new === 'object') {
              setProfile(payload.new as UserProfile);
            } else if (payload.eventType === 'DELETE') {
              setProfile(null);
            }
          }
        )
        .subscribe();

      return () => {
        console.log('Cleaning up profile subscription');
        supabase.removeChannel(channel);
      };
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user?.id, fetchProfile]); // Fixed dependencies to prevent multiple fetches

  // Force refresh function for manual updates
  const forceRefresh = useCallback(async () => {
    console.log('Force refreshing profile...');
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error force refreshing profile:', error);
        return;
      }

      console.log('Profile force refresh completed:', data);
      setProfile(data);
    } catch (error) {
      console.error('Error during force refresh:', error);
    }
  }, [user?.id]); // Direct implementation to avoid circular dependencies

  const updateBalance = async (newBalance: number, newEquity: number, newUsedMargin: number, newAvailableMargin: number) => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          balance: newBalance,
          equity: newEquity,
          used_margin: newUsedMargin,
          available_margin: newAvailableMargin,
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating balance:', error);
        return false;
      }

      setProfile(prev => prev ? {
        ...prev,
        balance: newBalance,
        equity: newEquity,
        used_margin: newUsedMargin,
        available_margin: newAvailableMargin,
      } : null);

      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  };

  return {
    profile,
    loading,
    refetch: fetchProfile,
    forceRefresh,
    updateBalance,
  };
};