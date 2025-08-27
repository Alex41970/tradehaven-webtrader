import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PulsingPriceIndicatorProps {
  price: number;
  change: number;
  symbol: string;
  className?: string;
}

export const PulsingPriceIndicator = ({ price, change, symbol, className }: PulsingPriceIndicatorProps) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const [prevPrice, setPrevPrice] = useState(price);

  useEffect(() => {
    if (price !== prevPrice) {
      setIsPulsing(true);
      setPrevPrice(price);
      
      const timer = setTimeout(() => {
        setIsPulsing(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [price, prevPrice]);

  const isPositive = change >= 0;
  const changePercent = ((change / (price - change)) * 100).toFixed(2);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        {isPositive ? (
          <TrendingUp className="h-4 w-4 text-green-600" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-600" />
        )}
        <span className={cn(
          "font-mono text-sm font-medium transition-all duration-300",
          isPulsing ? "animate-pulse bg-primary/20 px-2 py-1 rounded" : ""
        )}>
          {price.toFixed(4)}
        </span>
      </div>
      <div className={cn(
        "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all duration-300",
        isPositive 
          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" 
          : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
        isPulsing ? "ring-2 ring-primary/30" : ""
      )}>
        <span>{isPositive ? '+' : ''}{change.toFixed(4)}</span>
        <span>({isPositive ? '+' : ''}{changePercent}%)</span>
      </div>
    </div>
  );
};