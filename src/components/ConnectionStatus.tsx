import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useRealTimeTrading } from '@/hooks/useRealTimeTrading';
import { useIsMobile } from '@/hooks/use-mobile';

export const ConnectionStatus: React.FC = () => {
  const { isConnected, loading } = useRealTimeTrading();
  const isMobile = useIsMobile();

  // Mobile: Show only color-coded wireless icons
  if (isMobile) {
    if (loading) {
      return (
        <Wifi 
          className="h-4 w-4 text-yellow-500" 
          aria-label="Connecting to real-time data"
        />
      );
    }

    return isConnected ? (
      <Wifi 
        className="h-4 w-4 text-green-500" 
        aria-label="Real-time connection active"
      />
    ) : (
      <WifiOff 
        className="h-4 w-4 text-red-500" 
        aria-label="Real-time connection inactive"
      />
    );
  }

  // Desktop: Keep current badge layout
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