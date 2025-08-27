import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Asset } from "./useAssets";

export const useRealTimePrices = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    // Set up real-time subscription for asset price updates
    const channel = supabase
      .channel('price-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assets'
        },
        (payload) => {
          setLastUpdate(new Date());
          console.log('Price updated:', payload.new);
        }
      )
      .subscribe();

    // Start periodic price updates
    const updatePrices = async () => {
      if (isUpdating) return;
      
      setIsUpdating(true);
      try {
        const { data, error } = await supabase.functions.invoke('update-prices');
        
        if (error) {
          console.error('Error updating prices:', error);
        } else {
          console.log('Prices updated:', data);
        }
      } catch (error) {
        console.error('Price update error:', error);
      } finally {
        setIsUpdating(false);
      }
    };

    // Update prices immediately and then every 15 seconds
    updatePrices();
    const interval = setInterval(updatePrices, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [isUpdating]);

  const forceUpdate = async () => {
    if (isUpdating) return false;
    
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-prices');
      
      if (error) {
        console.error('Error updating prices:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Price update error:', error);
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    isUpdating,
    lastUpdate,
    forceUpdate,
  };
};