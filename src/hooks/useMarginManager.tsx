import { useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from './useAuth';
import { toast } from "@/hooks/use-toast";

/**
 * Centralized margin management hook
 * Provides automatic margin recalculation and validation functions
 */
export const useMarginManager = () => {
  const { user } = useAuth();

  /**
   * Automatically recalculates margins using database triggers
   * This is now handled by database triggers, but we keep this for manual fixes
   */
  const recalculateMargins = useCallback(async (userId?: string): Promise<boolean> => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) {
      console.error('No user ID provided for margin recalculation');
      return false;
    }

    try {
      console.log('Manually recalculating margins for user:', targetUserId);
      
      // Call the database function directly
      const { error } = await supabase.rpc('auto_recalculate_user_margins', {
        _user_id: targetUserId
      });

      if (error) {
        console.error('Error recalculating margins:', error);
        toast({
          title: "Error",
          description: "Failed to recalculate margins",
          variant: "destructive",
        });
        return false;
      }

      console.log('Margins recalculated successfully');
      return true;
    } catch (error) {
      console.error('Unexpected error during margin recalculation:', error);
      toast({
        title: "Error",
        description: "Failed to recalculate margins",
        variant: "destructive",
      });
      return false;
    }
  }, [user?.id]);

  /**
   * Validates margin consistency across all users
   * Useful for periodic checks and cleanup
   */
  const validateAllMargins = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Validating margin consistency for all users');
      
      const { error } = await supabase.rpc('validate_margin_consistency');

      if (error) {
        console.error('Error validating margins:', error);
        return false;
      }

      console.log('Margin validation completed successfully');
      return true;
    } catch (error) {
      console.error('Unexpected error during margin validation:', error);
      return false;
    }
  }, []);

  /**
   * Checks if a user's margins are consistent
   */
  const checkMarginConsistency = useCallback(async (userId?: string): Promise<{ consistent: boolean; details?: any }> => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) {
      return { consistent: false };
    }

    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('balance, used_margin, available_margin')
        .eq('user_id', targetUserId)
        .single();

      if (profileError || !profile) {
        return { consistent: false };
      }

      // Get open trades
      const { data: openTrades, error: tradesError } = await supabase
        .from('trades')
        .select('margin_used')
        .eq('user_id', targetUserId)
        .eq('status', 'open');

      if (tradesError) {
        return { consistent: false };
      }

      const actualUsedMargin = openTrades?.reduce((sum, trade) => sum + Number(trade.margin_used), 0) || 0;
      const expectedAvailableMargin = profile.balance - actualUsedMargin;

      const consistent = 
        Math.abs(profile.used_margin - actualUsedMargin) < 0.01 &&
        Math.abs(profile.available_margin - expectedAvailableMargin) < 0.01;

      return {
        consistent,
        details: {
          profileUsedMargin: profile.used_margin,
          actualUsedMargin,
          profileAvailableMargin: profile.available_margin,
          expectedAvailableMargin,
          balance: profile.balance
        }
      };
    } catch (error) {
      console.error('Error checking margin consistency:', error);
      return { consistent: false };
    }
  }, [user?.id]);

  return {
    recalculateMargins,
    validateAllMargins,
    checkMarginConsistency,
  };
};