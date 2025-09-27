import { usePrices } from '@/contexts/PriceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';

export const PriceDebugPanel = () => {
  const { prices, isConnected, lastUpdate, connectionStatus } = usePrices();

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="h-4 w-4" />;
      case 'connecting': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      default: return <WifiOff className="h-4 w-4" />;
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          Debug Panel
          <Badge className={`${getStatusColor()} text-white flex items-center gap-1`}>
            {getStatusIcon()}
            {connectionStatus}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div>Connected: {isConnected ? '✅' : '❌'}</div>
        <div>Prices in Map: {prices.size}</div>
        <div>Last Update: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}</div>
        <div>Connection Status: {connectionStatus}</div>
        {prices.size > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer">View Price Data ({prices.size} symbols)</summary>
            <div className="mt-2 max-h-32 overflow-y-auto">
              {Array.from(prices.entries()).map(([symbol, data]) => (
                <div key={symbol} className="text-xs">
                  {symbol}: ${data.price} ({data.change_24h.toFixed(2)}%) 
                  <span className="text-muted-foreground ml-1">
                    [{(data as any).source || 'fallback'}]
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
};