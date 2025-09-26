import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';
import { useRealTimeTrading } from '@/hooks/useRealTimeTrading';
import { usePrices } from '@/contexts/PriceContext';

const RealtimeStatusIndicator: React.FC = () => {
  const { isConnected: tradingConnected } = useRealTimeTrading();
  const { isConnected: pricesConnected } = usePrices();
  
  // Consider connected if either trading or prices are connected
  const isConnected = tradingConnected || pricesConnected;
  const connectionCount = (tradingConnected ? 1 : 0) + (pricesConnected ? 1 : 0);

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