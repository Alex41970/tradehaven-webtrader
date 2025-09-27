import { useMemo } from 'react';
import { Asset } from '@/hooks/useAssets';

interface UseOptimizedAssetsProps {
  assets: Asset[];
  searchTerm: string;
  selectedCategory: string;
  favorites: string[];
}

/**
 * Optimized asset filtering and sorting with memoization
 */
export const useOptimizedAssets = ({
  assets,
  searchTerm,
  selectedCategory,
  favorites
}: UseOptimizedAssetsProps) => {
  
  // Memoize filtered assets to prevent recalculation on every render
  const filteredAssets = useMemo(() => {
    let filtered = assets;

    // Filter by category if selected
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(asset => asset.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(asset => 
        asset.symbol.toLowerCase().includes(search) ||
        asset.name.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [assets, searchTerm, selectedCategory]);

  // Memoize favorite assets
  const favoriteAssets = useMemo(() => {
    return filteredAssets.filter(asset => favorites.includes(asset.symbol));
  }, [filteredAssets, favorites]);

  // Memoize asset lookup map for O(1) access
  const assetMap = useMemo(() => {
    const map = new Map<string, Asset>();
    assets.forEach(asset => {
      map.set(asset.symbol, asset);
    });
    return map;
  }, [assets]);

  // Optimized asset lookup function
  const getAssetBySymbol = useMemo(() => {
    return (symbol: string) => assetMap.get(symbol);
  }, [assetMap]);

  return {
    filteredAssets,
    favoriteAssets,
    getAssetBySymbol,
    totalAssets: assets.length,
    filteredCount: filteredAssets.length,
    favoriteCount: favoriteAssets.length
  };
};