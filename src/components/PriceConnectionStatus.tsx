import React from 'react';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Loader2, AlertTriangle, Radio } from 'lucide-react';
import { usePrices } from '@/contexts/PriceContext';
import { useIsMobile } from '@/hooks/use-mobile';

// Shows whether real market prices are fresh. "Live" means the server fetched prices in the last few minutes.
export const PriceConnectionStatus: React.FC = () => {
  const { connectionStatus, lastUpdate } = usePrices();
  const isMobile = useIsMobile();

  const age = () => {
    if (!lastUpdate) return '';
    const s = Math.max(0, Math.floor((Date.now() - lastUpdate.getTime()) / 1000));
    return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
  };

  if (isMobile) {
    if (connectionStatus === 'connecting') return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />;
    if (connectionStatus === 'paused') return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    if (connectionStatus === 'connected') return <Radio className="h-4 w-4 text-trading-success" />;
    return <WifiOff className="h-4 w-4 text-destructive" />;
  }

  if (connectionStatus === 'connecting') {
    return (
      <Badge variant="secondary" className="flex items-center gap-1.5 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />Loading prices...
      </Badge>
    );
  }

  if (connectionStatus === 'connected') {
    return (
      <Badge variant="secondary" className="flex items-center gap-1.5 text-xs">
        <Radio className="h-3 w-3 text-trading-success" />Live prices • {age()}
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="flex items-center gap-1.5 text-xs">
      <WifiOff className="h-3 w-3" />Prices delayed{lastUpdate && ` • ${age()}`}
    </Badge>
  );
};
