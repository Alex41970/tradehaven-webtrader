import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getActivityAwareSubscriptionManager } from "@/services/ActivityAwareSubscriptionManager";

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: 'crypto' | 'forex' | 'stock' | 'index' | 'commodity';
  price: number;
  change_24h: number;
  is_active: boolean;
  min_trade_size: number;
  max_leverage: number;
  spread: number;
  contract_size: number;
  base_currency: string | null;
  quote_currency: string | null;
  created_at: string;
  updated_at: string;
}

export const useAssets = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🎯 useAssets hook initializing...');
    fetchAssets();
    
    // Set up activity-aware real-time subscription for price updates
    const subscriptionManager = getActivityAwareSubscriptionManager(supabase);
    const subscriptionId = subscriptionManager.subscribe({
      channel: 'assets-updates',
      event: 'UPDATE',
      schema: 'public',
      table: 'assets',
      callback: (payload) => {
        console.log('🔄 Asset update received:', payload.new);
        setAssets(prev => prev.map(asset => 
          asset.id === payload.new.id ? payload.new as Asset : asset
        ));
      }
    });

    return () => {
      subscriptionManager.unsubscribe(subscriptionId);
    };
  }, []);

  const fetchAssets = async () => {
    try {
      console.log('📊 Starting to fetch assets from database...');
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('is_active', true)
        .order('symbol', { ascending: true });

      if (error) {
        console.error('❌ Error fetching assets:', error);
        toast({
          title: "Error",
          description: "Failed to fetch trading assets",
          variant: "destructive",
        });
        return;
      }

      console.log(`✅ Successfully fetched ${data?.length || 0} assets from database`);
      setAssets(data as Asset[] || []);
    } catch (error) {
      console.error('❌ Unexpected error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAssetPrice = async (assetId: string, newPrice: number, newChange: number) => {
    try {
      const { error } = await supabase
        .from('assets')
        .update({
          price: newPrice,
          change_24h: newChange,
        })
        .eq('id', assetId);

      if (error) {
        console.error('Error updating asset price:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  };

  return {
    assets,
    loading,
    refetch: fetchAssets,
    updateAssetPrice,
  };
};