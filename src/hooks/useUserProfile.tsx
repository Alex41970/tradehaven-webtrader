import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: "Error",
          description: "Failed to fetch profile data",
          variant: "destructive",
        });
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

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
    updateBalance,
  };
};