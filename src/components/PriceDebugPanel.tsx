import { useState } from 'react';
import { usePrices } from '@/contexts/PriceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Loader2, AlertTriangle, TestTube2, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PriceAgeIndicator } from './PriceAgeIndicator';

// FREE TIER test symbols
const FREE_TIER_SYMBOLS = [
  'BTCUSD', 'ETHUSD', 'BNBUSD', 'XRPUSD', 'SOLUSD', 'DOGEUSD',
  'EURUSD', 'GBPUSD', 'USDJPY', 'AAPL', 'TSLA', 'NVDA'
];

export const PriceDebugPanel = () => {
  const { prices, isConnected, lastUpdate, connectionStatus } = usePrices();
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'paused': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="h-4 w-4" />;
      case 'connecting': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'paused': return <AlertTriangle className="h-4 w-4" />;
      default: return <WifiOff className="h-4 w-4" />;
    }
  };

  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      // Wake the relay
      const { data: relayData, error: relayError } = await supabase.functions.invoke('websocket-price-relay', {
        body: { action: 'ping' }
      });

      // Check presence
      const presenceChannel = supabase.channel('price-relay-presence');
      await presenceChannel.subscribe();
      const presenceState = presenceChannel.presenceState();
      const activeClients = Object.keys(presenceState).length;
      await supabase.removeChannel(presenceChannel);

      // Calculate price freshness
      const ageMs = lastUpdate ? Date.now() - lastUpdate.getTime() : null;
      const ageSec = ageMs ? Math.floor(ageMs / 1000) : null;

      setDiagnosticResults({
        relay: relayError ? { error: relayError.message } : relayData,
        presenceClients: activeClients,
        priceAge: ageSec ? `${ageSec}s ago` : 'No updates yet',
        isFresh: ageSec ? ageSec < 15 : false
      });
    } catch (error) {
      console.error('Diagnostics failed:', error);
      setDiagnosticResults({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const liveSymbols = FREE_TIER_SYMBOLS.filter(symbol => prices.has(symbol));
  const livePriceCount = liveSymbols.length;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          Debug Panel
          <Badge className={`${getStatusColor()} text-white flex items-center gap-1`}>
            {getStatusIcon()}
            {connectionStatus}
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            FREE TIER
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div>Connected: {isConnected ? '✅' : '❌'}</div>
        <div>Mode: <span className="font-semibold text-orange-500">Testing (12 Assets)</span></div>
        <div>Live Prices: {livePriceCount}/12 symbols</div>
        <div>Total Prices Loaded: {prices.size}</div>
        <div>Last Update: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}</div>
        {lastUpdate && <PriceAgeIndicator priceTimestamp={lastUpdate} />}
        <div>Connection Status: {connectionStatus}</div>
        <div>Source: {isConnected ? 'Twelve Data WebSocket' : 'Pending'}</div>
        
        {livePriceCount > 0 && (
          <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded">
            <div className="font-semibold text-green-700 dark:text-green-300">✓ Live Updates Active</div>
            <div className="text-green-600 dark:text-green-400 text-xs mt-1">
              {liveSymbols.slice(0, 6).join(', ')}
            </div>
          </div>
        )}
        
        <Button
          onClick={runDiagnostics}
          disabled={isRunningDiagnostics}
          size="sm"
          variant="outline"
          className="w-full mt-2"
        >
          <TestTube2 className="h-3 w-3 mr-2" />
          {isRunningDiagnostics ? 'Testing...' : 'Test Price Connection'}
        </Button>

        {diagnosticResults && (
          <div className="mt-2 p-2 bg-muted rounded text-xs space-y-1">
            {diagnosticResults.error ? (
              <div className="text-red-500">Error: {diagnosticResults.error}</div>
            ) : (
              <div>
                <div className="font-medium mb-1">Relay Diagnostics</div>
                {diagnosticResults.relay && (
                  <div className="text-green-600">
                    ✓ Relay: {diagnosticResults.relay.status} ({diagnosticResults.relay.mode}, {diagnosticResults.relay.symbols} symbols)
                  </div>
                )}
                <div className={diagnosticResults.isFresh ? 'text-green-600' : 'text-orange-600'}>
                  {diagnosticResults.isFresh ? '✓' : '⚠'} Price Age: {diagnosticResults.priceAge}
                </div>
                <div className="text-blue-600">
                  👥 Active Clients: {diagnosticResults.presenceClients}
                </div>
              </div>
            )}
          </div>
        )}
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