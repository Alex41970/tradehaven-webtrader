import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Pause, Clock, Zap, TestTube } from 'lucide-react';
import { useRealTimeTrading } from '@/hooks/useRealTimeTrading';
import { usePrices } from '@/contexts/PriceContext';

const RealtimeStatusIndicator: React.FC = () => {
  const { isConnected: tradingConnected } = useRealTimeTrading();
  const { isConnected, isUserActive, connectionStatus } = usePrices();
  
  // Determine overall status
  const isAnyConnected = tradingConnected || isConnected;
  const connectionCount = (tradingConnected ? 1 : 0) + (isConnected ? 1 : 0);

  // Determine display state
  if (connectionStatus === 'paused' || !isUserActive) {
    return (
      <Badge 
        variant="outline" 
        className="flex items-center gap-1 text-xs"
        title="Subscriptions paused due to inactivity"
      >
        <Pause className="h-3 w-3" />
        Paused
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
    <div className="flex items-center gap-2">
      <Badge 
        variant={isAnyConnected ? "default" : "secondary"} 
        className="flex items-center gap-1 text-xs"
      >
        {isConnected ? (
          <>
            <Zap className="h-3 w-3" />
            Live ({connectionCount})
          </>
        ) : tradingConnected ? (
          <>
            <Wifi className="h-3 w-3" />
            Trading ({connectionCount})
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            Offline
          </>
        )}
      </Badge>
      {isConnected && (
        <Badge 
          variant="outline" 
          className="flex items-center gap-1 text-xs border-orange-500 text-orange-500"
        >
          <TestTube className="h-3 w-3" />
          Testing (12)
        </Badge>
      )}
    </div>
  );
};

export default RealtimeStatusIndicator;