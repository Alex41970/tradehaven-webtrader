import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAssets } from "@/hooks/useAssets";
import { useTrades } from "@/hooks/useTrades";
import { useUserProfile } from "@/hooks/useUserProfile";

interface RealTimePriceServiceProps {
  children: React.ReactNode;
}

export const RealTimePriceService = ({ children }: RealTimePriceServiceProps) => {
  const { refetch: refetchAssets } = useAssets();
  const { refetch: refetchTrades } = useTrades();
  const { refetch: refetchProfile } = useUserProfile();

  useEffect(() => {
    console.log('Setting up real-time price service...');

    // Subscribe to real-time updates for assets (price changes)
    const assetsChannel = supabase
      .channel('asset-price-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assets'
        },
        (payload) => {
          console.log('Asset price updated:', payload.new);
          // Refetch assets to get latest prices
          refetchAssets();
        }
      )
      .subscribe();

    // Subscribe to real-time updates for trades (P&L changes)
    const tradesChannel = supabase
      .channel('trade-pnl-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trades'
        },
        (payload) => {
          console.log('Trade P&L updated:', payload.new);
          // Refetch trades to get latest P&L
          refetchTrades();
        }
      )
      .subscribe();

    // Subscribe to user profile updates (balance changes)
    const profileChannel = supabase
      .channel('profile-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles'
        },
        (payload) => {
          console.log('Profile updated:', payload.new);
          // Refetch profile to get latest balance
          refetchProfile();
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      console.log('Cleaning up real-time subscriptions');
      supabase.removeChannel(assetsChannel);
      supabase.removeChannel(tradesChannel);
      supabase.removeChannel(profileChannel);
    };
  }, []); // Empty dependency array to prevent multiple setups

  return <>{children}</>;
};