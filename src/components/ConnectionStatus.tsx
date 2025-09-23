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

  // Desktop: Use same icon approach as mobile for cleaner header
  if (loading) {
    return (
      <Loader2 
        className="h-4 w-4 text-yellow-500 animate-spin" 
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
};