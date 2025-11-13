import { useState } from 'react';
import { usePrices } from '@/contexts/PriceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Loader2, AlertTriangle, TestTube2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const PriceDebugPanel = () => {
  const { prices, isConnected, lastUpdate, connectionStatus } = usePrices();
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

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

  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      // TODO: Implement Twelve Data diagnostics
      setDiagnosticResults({ message: 'Twelve Data diagnostics - coming soon' });
    } catch (error) {
      console.error('Diagnostics failed:', error);
      setDiagnosticResults({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRunningDiagnostics(false);
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
        <div>Source: {isConnected ? 'Twelve Data' : 'Pending'}</div>
        
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
          <div className="mt-2 p-2 bg-muted rounded text-xs">
            {diagnosticResults.error ? (
              <div className="text-red-500">Error: {diagnosticResults.error}</div>
            ) : (
              <div>
                <div className="font-medium mb-1">
                  Tests: {diagnosticResults.summary?.successful || 0}/{diagnosticResults.summary?.total || 0} passed
                </div>
                {diagnosticResults.results?.filter((r: any) => r.success).slice(0, 3).map((result: any, i: number) => (
                  <div key={i} className="text-green-600">✓ {result.test}</div>
                ))}
                {diagnosticResults.results?.filter((r: any) => !r.success).slice(0, 2).map((result: any, i: number) => (
                  <div key={i} className="text-red-500">✗ {result.test}</div>
                ))}
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