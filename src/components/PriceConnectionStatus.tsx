import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';
import { useRealTimePrices } from '@/hooks/useRealTimePrices';
import { useIsMobile } from '@/hooks/use-mobile';

export const PriceConnectionStatus: React.FC = () => {
  const { connectionStatus, isConnected, lastUpdate } = useRealTimePrices();
  const isMobile = useIsMobile();

  // Mobile: Show only color-coded wireless icons
  if (isMobile) {
    if (connectionStatus === 'connecting') {
      return (
        <Loader2 
          className="h-4 w-4 text-yellow-500 animate-spin" 
          aria-label="Connecting to price service"
        />
      );
    }

    if (connectionStatus === 'paused') {
      return (
        <AlertTriangle 
          className="h-4 w-4 text-yellow-500" 
          aria-label="Paused"
        />
      );
    }

    return isConnected ? (
      <Wifi 
        className="h-4 w-4 text-green-500" 
        aria-label="Live prices"
      />
    ) : (
      <WifiOff 
        className="h-4 w-4 text-red-500" 
        aria-label="Offline"
      />
    );
  }

  // Desktop: Show detailed badge
  if (connectionStatus === 'connecting') {
    return (
      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Connecting...
      </Badge>
    );
  }

  if (connectionStatus === 'paused') {
    return (
      <Badge variant="outline" className="flex items-center gap-1 text-xs border-yellow-500/50 text-yellow-600">
        <AlertTriangle className="h-3 w-3" />
        Paused
      </Badge>
    );
  }

  return (
    <Badge 
      variant={isConnected ? "default" : "destructive"} 
      className="flex items-center gap-1 text-xs"
    >
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          Live
          {lastUpdate && (
            <span className="text-xs opacity-70">
              • {lastUpdate.toLocaleTimeString([], { timeStyle: 'short' })}
            </span>
          )}
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