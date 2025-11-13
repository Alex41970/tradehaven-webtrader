import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { useRealTimePrices } from '@/hooks/useRealTimePrices';
import { useActivity } from '@/contexts/ActivityContext';

export const MarketTickIndicator = () => {
  const { lastUpdate, isConnected, isUserActive } = useRealTimePrices();
  const { isUserActive: isActivityActive } = useActivity();
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (lastUpdate && isConnected && isUserActive && isActivityActive) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 300);
      return () => clearTimeout(timer);
    }
  }, [lastUpdate, isConnected, isUserActive, isActivityActive]);

  if (!isConnected || !isUserActive || !isActivityActive) return null;

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