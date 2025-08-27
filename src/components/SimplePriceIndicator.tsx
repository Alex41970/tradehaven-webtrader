import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SimplePriceIndicatorProps {
  price: number;
  symbol: string;
  className?: string;
}

export const SimplePriceIndicator = ({ price, symbol, className }: SimplePriceIndicatorProps) => {
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

  const safePrice = isNaN(price) ? 0 : price;

  return (
    <span className={cn(
      "font-mono font-medium transition-all duration-300",
      isPulsing ? "animate-pulse bg-primary/20 px-2 py-1 rounded" : "",
      className
    )}>
      {safePrice.toFixed(symbol.includes('JPY') ? 2 : 4)}
    </span>
  );
};