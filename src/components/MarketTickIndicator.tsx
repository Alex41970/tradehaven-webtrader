import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { useRealTimePrices } from '@/hooks/useRealTimePrices';

export const MarketTickIndicator = () => {
  const { lastUpdate, isConnected } = useRealTimePrices();
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (lastUpdate && isConnected) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 300);
      return () => clearTimeout(timer);
    }
  }, [lastUpdate, isConnected]);

  if (!isConnected) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <Zap 
        className={`h-3 w-3 transition-all duration-200 ${
          isFlashing 
            ? 'text-green-500 animate-pulse' 
            : 'text-muted-foreground'
        }`} 
      />
      <span className={`text-xs font-mono transition-all duration-200 ${
        isFlashing 
          ? 'text-green-500 font-medium' 
          : 'text-muted-foreground'
      }`}>
        LIVE
      </span>
    </div>
  );
};