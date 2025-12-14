import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";

export interface Favorite {
  id: string;
  user_id: string;
  asset_id: string;
  created_at: string;
}

export const useFavorites = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    } else {
      setFavorites([]);
      setLoading(false);
    }
  }, [user]);

  const fetchFavorites = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        return;
      }

      setFavorites(data || []);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const addFavorite = async (assetId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('user_favorites')
        .insert({
          user_id: user.id,
          asset_id: assetId,
        });

      if (error) {
        return false;
      }

      await fetchFavorites();
      toast({
        title: "Added to Favorites",
        description: "Asset added to your favorites list",
      });
      return true;
    } catch {
      return false;
    }
  };

  const removeFavorite = async (assetId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('asset_id', assetId);

      if (error) {
        return false;
      }

      await fetchFavorites();
      toast({
        title: "Removed from Favorites",
        description: "Asset removed from your favorites list",
      });
      return true;
    } catch {
      return false;
    }
  };

  const isFavorite = (assetId: string) => {
    return favorites.some(fav => fav.asset_id === assetId);
  };

  return {
    favorites,
    loading,
    addFavorite,
    removeFavorite,
    isFavorite,
    refetch: fetchFavorites,
  };
};
