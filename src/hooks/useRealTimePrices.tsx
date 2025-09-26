import { usePrices } from '@/contexts/PriceContext';
import { Asset } from './useAssets';

export const useRealTimePrices = () => {
  const { prices, isConnected, lastUpdate, connectionStatus, isPaused } = usePrices();

  const getPriceForAsset = (symbol: string) => {
    const priceData = prices.get(symbol);
    if (priceData) {
      console.log('🔍 Price found for', symbol, ':', priceData.price);
    }
    return priceData;
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
    isPaused,
    getPriceForAsset,
    getUpdatedAsset,
    getUpdatedAssets,
    isUpdating: connectionStatus === 'connecting'
  };
};