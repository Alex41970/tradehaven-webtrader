import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useRealTimeTrading } from '@/hooks/useRealTimeTrading';

export const ConnectionStatus: React.FC = () => {
  const { isConnected, loading } = useRealTimeTrading();

  if (loading) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
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
          Real-time Active
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Database Mode
        </>
      )}
    </Badge>
  );
};