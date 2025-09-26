import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Pause, Clock } from 'lucide-react';
import { useRealTimeTrading } from '@/hooks/useRealTimeTrading';
import { usePrices } from '@/contexts/PriceContext';
import { useActivity } from '@/contexts/ActivityContext';

const RealtimeStatusIndicator: React.FC = () => {
  const { isConnected: tradingConnected } = useRealTimeTrading();
  const { isConnected: pricesConnected, isPaused: pricesPaused, connectionStatus } = usePrices();
  const { isUserActive, minutesSinceLastActivity, forceActive } = useActivity();
  
  // Determine overall status
  const isConnected = tradingConnected || pricesConnected;
  const isPaused = pricesPaused || !isUserActive;
  const connectionCount = (tradingConnected ? 1 : 0) + (pricesConnected ? 1 : 0);

  // Handle click to resume activity
  const handleClick = () => {
    if (isPaused) {
      forceActive();
    }
  };

  // Determine display state
  if (isPaused) {
    return (
      <Badge 
        variant="outline" 
        className="flex items-center gap-1 text-xs cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={handleClick}
        title="Click to resume real-time updates"
      >
        <Pause className="h-3 w-3" />
        Paused ({minutesSinceLastActivity}m)
      </Badge>
    );
  }

  if (connectionStatus === 'connecting') {
    return (
      <Badge 
        variant="outline" 
        className="flex items-center gap-1 text-xs"
      >
        <Clock className="h-3 w-3 animate-spin" />
        Connecting...
      </Badge>
    );
  }

  return (
    <Badge 
      variant={isConnected ? "default" : "secondary"} 
      className="flex items-center gap-1 text-xs"
    >
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          Live ({connectionCount})
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Offline
        </>
      )}
    </Badge>
  );
};

export default RealtimeStatusIndicator;