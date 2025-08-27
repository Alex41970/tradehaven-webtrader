import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MarketData {
  symbol: string;
  price: string;
  change: number;
  changePercent: number;
}

const mockMarketData: MarketData[] = [
  { symbol: "BTC/USD", price: "43,250.80", change: 1250.30, changePercent: 2.98 },
  { symbol: "ETH/USD", price: "2,680.45", change: -45.20, changePercent: -1.66 },
  { symbol: "EUR/USD", price: "1.0875", change: 0.0012, changePercent: 0.11 },
  { symbol: "GBP/USD", price: "1.2695", change: -0.0023, changePercent: -0.18 },
  { symbol: "USD/JPY", price: "149.85", change: 0.45, changePercent: 0.30 },
  { symbol: "S&P 500", price: "4,785.20", change: 12.45, changePercent: 0.26 },
  { symbol: "GOLD", price: "2,045.80", change: -8.90, changePercent: -0.43 },
  { symbol: "OIL", price: "78.25", change: 1.15, changePercent: 1.49 },
];

export const MarketTicker = () => {
  const [currentData, setCurrentData] = useState(mockMarketData);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentData(prev => 
        prev.map(item => ({
          ...item,
          change: item.change + (Math.random() - 0.5) * 0.1,
          changePercent: item.changePercent + (Math.random() - 0.5) * 0.05,
        }))
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full overflow-hidden bg-trading-secondary/20 border-b border-border/50">
      <div className="flex animate-[scroll_60s_linear_infinite] gap-8 py-2">
        {[...currentData, ...currentData].map((item, index) => (
          <div key={`${item.symbol}-${index}`} className="flex items-center gap-2 whitespace-nowrap px-4">
            <span className="font-semibold text-sm">{item.symbol}</span>
            <span className="text-sm font-mono">${item.price}</span>
            <div className={`flex items-center gap-1 text-xs ${
              item.changePercent >= 0 ? 'text-trading-success' : 'text-trading-danger'
            }`}>
              {item.changePercent >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};