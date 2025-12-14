import { usePrices } from '@/contexts/PriceContext';
import { Asset } from './useAssets';

export const useRealTimePrices = () => {
  const { prices, isConnected, lastUpdate, connectionStatus, isUserActive } = usePrices();

  const getPriceForAsset = (symbol: string) => {
    return prices.get(symbol);
  };

  const getUpdatedAsset = (asset: Asset): Asset => {
    const priceUpdate = prices.get(asset.symbol);
    if (priceUpdate) {
      return {
        ...asset,
        price: priceUpdate.price,
        change_24h: priceUpdate.change_24h,
        updated_at: new Date(priceUpdate.timestamp).toISOString()
      };
    }
    return asset;
  };

  const getUpdatedAssets = (assets: Asset[]): Asset[] => {
    return assets.map(asset => getUpdatedAsset(asset));
  };

  return {
    prices,
    isConnected,
    lastUpdate,
    connectionStatus,
    isUserActive,
    getPriceForAsset,
    getUpdatedAsset,
    getUpdatedAssets,
    isUpdating: connectionStatus === 'connecting'
  };
};