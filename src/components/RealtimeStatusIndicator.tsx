import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';
import { useRealtimeData } from '@/hooks/useRealtimeData';

const RealtimeStatusIndicator: React.FC = () => {
  const { activeSubscriptions } = useRealtimeData();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setIsConnected(activeSubscriptions > 0);
  }, [activeSubscriptions]);

  return (
    <Badge 
      variant={isConnected ? "default" : "secondary"} 
      className="flex items-center gap-1 text-xs"
    >
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          Live ({activeSubscriptions})
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