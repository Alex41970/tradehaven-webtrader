import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2, AlertTriangle, Radio, RefreshCw } from 'lucide-react';
import { usePrices } from '@/contexts/PriceContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';

export const PriceConnectionStatus: React.FC = () => {
  const { connectionStatus, isConnected, lastUpdate, connectionMode } = usePrices();
  const isMobile = useIsMobile();

  const handleRetry = async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.functions.invoke('websocket-price-relay');
    } catch (error) {
      console.error('Failed to retry:', error);
    }
  };

  const getTimeSince = () => {
    if (!lastUpdate) return null;
    const s = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
  };

  if (isMobile) {
    if (connectionStatus === 'connecting') return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
    if (connectionStatus === 'paused') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (connectionMode === 'websocket' && isConnected) return <Wifi className="h-4 w-4 text-green-500 animate-pulse" />;
    if (connectionMode === 'polling' && isConnected) return <Radio className="h-4 w-4 text-blue-500" />;
    return <WifiOff className="h-4 w-4 text-red-500" />;
  }

  if (connectionStatus === 'connecting') {
    return <Badge variant="secondary" className="flex items-center gap-1.5 text-xs">
      <Loader2 className="h-3 w-3 animate-spin" />Connecting...
    </Badge>;
  }

  if (connectionMode === 'websocket' && isConnected) {
    return <Badge variant="default" className="flex items-center gap-1.5 text-xs bg-green-600">
      <Wifi className="h-3 w-3 animate-pulse" />Live WebSocket{lastUpdate && ` • ${getTimeSince()}`}
    </Badge>;
  }

  if (connectionMode === 'polling' && isConnected) {
    return <div className="flex items-center gap-2">
      <Badge variant="secondary" className="flex items-center gap-1.5 text-xs bg-blue-600 text-white">
        <Radio className="h-3 w-3" />Polling (15s){lastUpdate && ` • ${getTimeSince()}`}
      </Badge>
      <Button variant="ghost" size="sm" onClick={handleRetry} className="h-6 px-2">
        <RefreshCw className="h-3 w-3" />
      </Button>
    </div>;
  }

  return <div className="flex items-center gap-2">
    <Badge variant="destructive" className="flex items-center gap-1.5 text-xs">
      <WifiOff className="h-3 w-3" />Offline
    </Badge>
    <Button variant="ghost" size="sm" onClick={handleRetry} className="h-6 px-2">
      <RefreshCw className="h-3 w-3" />
    </Button>
  </div>;
};
