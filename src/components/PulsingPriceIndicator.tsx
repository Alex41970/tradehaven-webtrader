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
    if (price !== prevPrice && !isNaN(price) && !isNaN(prevPrice)) {
      setIsPulsing(true);
      setPrevPrice(price);
      
      const timer = setTimeout(() => {
        setIsPulsing(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [price, prevPrice]);

  // Add safety checks for price and change values
  const safePrice = isNaN(price) ? 0 : price;
  const safeChange = isNaN(change) ? 0 : change;
  const isPositive = safeChange >= 0;
  
  let changePercent = '0.00';
  try {
    const basePrice = safePrice - safeChange;
    if (basePrice !== 0) {
      changePercent = ((safeChange / basePrice) * 100).toFixed(2);
    }
  } catch (error) {
    console.error('Error calculating change percent:', error);
  }

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
          {safePrice.toFixed(symbol.includes('JPY') ? 2 : 4)}
        </span>
      </div>
      <div className={cn(
        "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all duration-300",
        isPositive 
          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" 
          : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
        isPulsing ? "ring-2 ring-primary/30" : ""
      )}>
        <span>{isPositive ? '+' : ''}{changePercent}%</span>
      </div>
    </div>
  );
};