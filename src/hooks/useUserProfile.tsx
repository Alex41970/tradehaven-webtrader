import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";
import { useRealtimeUserProfile } from './useRealtimeData';

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Enable enhanced real-time updates
  useRealtimeUserProfile(user?.id);

  // Listen for real-time profile updates from the enhanced system
  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent) => {
      console.log('🔄 Profile updated via enhanced real-time:', event.detail);
      setProfile(event.detail);
    };

    window.addEventListener('profile_updated', handleProfileUpdate as EventListener);
    return () => {
      window.removeEventListener('profile_updated', handleProfileUpdate as EventListener);
    };
  }, []);

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
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user?.id, fetchProfile]);

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

  const recalculateMargins = useCallback(async () => {
    if (!user) {
      console.error('No user found for margin recalculation');
      return false;
    }

    try {
      console.log('Fixing margins for user:', user.id);
      
      const response = await fetch(`https://stdfkfutgkmnaajixguz.supabase.co/functions/v1/fix-user-margins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZGZrZnV0Z2ttbmFhaml4Z3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTI3NjUsImV4cCI6MjA3MTg4ODc2NX0.kf5keye0-ezD9cjcvTWxMsBbpVELf_cWIwL2OeW0Yg4`,
        },
        body: JSON.stringify({ user_id: user.id })
      });

      const result = await response.json();

      if (result.success) {
        console.log('Margins fixed successfully:', result);
        
        // Force refresh the profile after successful fix
        await forceRefresh();
        
        toast({
          title: "Success",
          description: "Margins fixed successfully",
        });
        return true;
      } else {
        console.error('Failed to fix margins:', result.error);
        toast({
          title: "Error", 
          description: result.error || "Failed to fix margins",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error('Unexpected error during margin fix:', error);
      toast({
        title: "Error",
        description: "Failed to connect to margin fix service",
        variant: "destructive",
      });
      return false;
    }
  }, [user?.id, forceRefresh, toast]);

  // Auto-fix margins on component mount if they seem incorrect
  useEffect(() => {
    if (profile && user?.id) {
      // Check if margins need recalculation (e.g., if used_margin > 0 but no open trades)
      const timeoutId = setTimeout(async () => {
        try {
          const { data: openTrades } = await supabase
            .from('trades')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'open');

          const hasOpenTrades = openTrades && openTrades.length > 0;
          const hasIncorrectMargin = profile.used_margin > 0;

          if (!hasOpenTrades && hasIncorrectMargin) {
            console.log('Detected incorrect margin values, auto-fixing...');
            await recalculateMargins();
          }
        } catch (error) {
          console.error('Error checking margin consistency:', error);
        }
      }, 1000); // Small delay to ensure data is loaded

      return () => clearTimeout(timeoutId);
    }
  }, [profile?.id, user?.id, recalculateMargins]);

  return {
    profile,
    loading,
    refetch: fetchProfile,
    forceRefresh,
    updateBalance,
    recalculateMargins,
  };
};