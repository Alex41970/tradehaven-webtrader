import { TrendingUp, TrendingDown } from "lucide-react";
import { useAssets } from "@/hooks/useAssets";

export const MarketTicker = () => {
  const { assets } = useAssets();

  // Get the first 8 assets for ticker display
  const tickerAssets = assets.slice(0, 8);

  if (tickerAssets.length === 0) {
    return null; // Don't show ticker if no assets loaded
  }

  const changePercent = (asset: any) => ((asset.change_24h / (asset.price - asset.change_24h)) * 100);

  return (
    <div className="w-full overflow-hidden bg-trading-secondary/20 border-b border-border/50">
      <div className="flex animate-[scroll_60s_linear_infinite] gap-8 py-2">
        {[...tickerAssets, ...tickerAssets].map((asset, index) => {
          const percent = changePercent(asset);
          return (
            <div key={`${asset.symbol}-${index}`} className="flex items-center gap-2 whitespace-nowrap px-4">
              <span className="font-semibold text-sm">{asset.symbol}</span>
              <span className="text-sm font-mono">{asset.price.toFixed(asset.category === 'forex' ? 4 : 2)}</span>
              <div className={`flex items-center gap-1 text-xs ${
                percent >= 0 ? 'text-trading-success' : 'text-trading-danger'
              }`}>
                {percent >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{percent >= 0 ? '+' : ''}{percent.toFixed(2)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};