import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: 'forex' | 'crypto' | 'stocks' | 'commodities' | 'indices';
  price: number;
  change_24h: number;
  is_active: boolean;
  min_trade_size: number;
  max_leverage: number;
  spread: number;
  created_at: string;
  updated_at: string;
}

export const useAssets = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssets();
    
    // Set up real-time subscription for price updates
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assets'
        },
        (payload) => {
          setAssets(prev => prev.map(asset => 
            asset.id === payload.new.id ? payload.new as Asset : asset
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('symbol', { ascending: true });

      if (error) {
        console.error('Error fetching assets:', error);
        toast({
          title: "Error",
          description: "Failed to fetch trading assets",
          variant: "destructive",
        });
        return;
      }

      setAssets(data as Asset[] || []);
    } catch (error) {
      console.error('Error:', error);
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