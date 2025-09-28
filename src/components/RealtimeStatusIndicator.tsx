import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Pause, Clock, Zap } from 'lucide-react';
import { useRealTimeTrading } from '@/hooks/useRealTimeTrading';
import { usePrices } from '@/contexts/PriceContext';
import { useActivity } from '@/contexts/ActivityContext';

const RealtimeStatusIndicator: React.FC = () => {
  const { isConnected: tradingConnected } = useRealTimeTrading();
  const { isConnected, isPaused, connectionStatus, allTickConnected, edgeFunctionConnected } = usePrices();
  const { isUserActive, minutesSinceLastActivity, forceActive } = useActivity();
  
  // Determine overall status
  const isAnyConnected = tradingConnected || isConnected;
  const isPausedState = isPaused || !isUserActive;
  const connectionCount = (tradingConnected ? 1 : 0) + (allTickConnected ? 1 : 0) + (edgeFunctionConnected ? 1 : 0);

  // Handle click to resume activity
  const handleClick = () => {
    if (isPausedState) {
      forceActive();
    }
  };

  // Determine display state - show AllTick priority
  if (isPausedState) {
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
      variant={isAnyConnected ? "default" : "secondary"} 
      className="flex items-center gap-1 text-xs"
    >
      {allTickConnected ? (
        <>
          <Zap className="h-3 w-3" />
          AllTick Direct ({connectionCount})
        </>
      ) : isAnyConnected ? (
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