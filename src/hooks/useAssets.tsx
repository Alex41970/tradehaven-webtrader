import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: 'crypto' | 'forex' | 'stock' | 'stocks' | 'index' | 'indices' | 'commodity' | 'commodities';
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
    // Simple fetch on mount - prices come via PriceContext, no need for real-time subscription
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('is_active', true)
        .order('symbol', { ascending: true });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to fetch trading assets",
          variant: "destructive",
        });
        return;
      }

      setAssets(data as Asset[] || []);
    } catch (error) {
      // Silent fail - assets will be empty
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
        return false;
      }

      return true;
    } catch (error) {
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
