
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTrades } from "@/hooks/useTrades";
import { useSharedUserProfile } from "@/hooks/useSharedUserProfile";
import { useAssets } from "@/hooks/useAssets";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle } from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { useRealtimeAccountMetrics } from "@/hooks/useRealtimeAccountMetrics";
import { TradeRow } from "@/components/TradeRow";
import { PortfolioSkeleton } from "./PortfolioSkeleton";

export const Portfolio = () => {
  // ALL HOOKS MUST BE CALLED FIRST - NO CONDITIONAL HOOK CALLS
  const { openTrades, closeTrade } = useTrades();
  const { profile, loading: profileLoading } = useSharedUserProfile();
  const { assets, loading: assetsLoading } = useAssets();
  const { toast } = useToast();
  const { getUpdatedAssets } = useRealTimePrices();
  const { openPnL, lastUpdated, realTimeEquity, totalUsedMargin } = useRealtimeAccountMetrics();
  const [closingTrades, setClosingTrades] = useState<Set<string>>(new Set());

  const updatedAssets = useMemo(() => {
    if (!assets || assets.length === 0) {
      return [];
    }
    try {
      return getUpdatedAssets(assets);
    } catch {
      return assets;
    }
  }, [assets, getUpdatedAssets]);

  // Stop-loss / take-profit are executed on the server at real market prices (price-feed)
  // Open profit and loss only (credit is part of equity, not of profit)
  const totalPnL = openPnL;

  // Calculate risk metrics
  const riskMetrics = useMemo(() => {
    if (!profile || !openTrades) {
      return { marginUtilization: 0, largestExposure: 0, riskLevel: 'Low' as const };
    }

    // Live figures, the same ones the top bar shows: margin in use as a share of equity
    const marginUtilization = totalUsedMargin <= 0 ? 0
      : realTimeEquity > 0 ? Math.min((totalUsedMargin / realTimeEquity) * 100, 100) : 100;
    
    const largestExposure = openTrades.reduce((max, trade) => {
      const exposure = trade.amount * (trade.leverage || 1);
      return Math.max(max, exposure);
    }, 0);

    let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
    if (marginUtilization > 70) riskLevel = 'High';
    else if (marginUtilization > 40) riskLevel = 'Medium';

    return { marginUtilization, largestExposure, riskLevel };
  }, [profile, openTrades, realTimeEquity, totalUsedMargin]);

  // The trade keeps counting until the server confirms the close; balance and the trade
  // list then change together, so equity never jumps in between.
  const handleCloseTrade = useCallback(async (tradeId: string, symbol: string) => {
    if (closingTrades.has(tradeId)) return;

    const asset = updatedAssets.find(a => a.symbol === symbol);
    if (!asset?.price || isNaN(asset.price)) {
      toast({ title: "Error", description: "No current price for this market yet. Try again in a moment.", variant: "destructive" });
      return;
    }

    setClosingTrades(prev => new Set(prev).add(tradeId));
    try {
      await closeTrade(tradeId, asset.price);
    } catch (error) {
      toast({
        title: "Could not close the trade",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setClosingTrades(prev => {
        const next = new Set(prev);
        next.delete(tradeId);
        return next;
      });
    }
  }, [updatedAssets, closeTrade, toast, closingTrades]);

  // Real-time updates are now handled by the WebSocket system

  // NOW we can do conditional rendering AFTER all hooks are called
  if (profileLoading || assetsLoading) {
    return <PortfolioSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTrades?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold animate-pulse-subtle ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </div>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                Updated: {lastUpdated.toLocaleTimeString()}
                <span className="ml-2 text-primary animate-pulse">●</span>
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Metrics</CardTitle>
            <div className="flex items-center gap-1">
              {riskMetrics.riskLevel === 'High' ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : (
                <Shield className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              riskMetrics.riskLevel === 'High' ? 'text-red-500' : 
              riskMetrics.riskLevel === 'Medium' ? 'text-yellow-500' : 'text-green-500'
            }`}>
              {riskMetrics.marginUtilization.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Margin Used • Risk: {riskMetrics.riskLevel}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Max Exposure: ${riskMetrics.largestExposure.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Positions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Open Positions</CardTitle>
          <CardDescription>Manage your active trades</CardDescription>
        </CardHeader>
        <CardContent>
          {!openTrades || openTrades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No open positions
            </div>
          ) : (
            <div className="space-y-4">
              {openTrades.map((trade) => {
                const asset = updatedAssets.find(a => a.symbol === trade.symbol);
                
                return (
                  <TradeRow
                    key={trade.id}
                    trade={trade}
                    asset={asset}
                    onCloseTrade={handleCloseTrade}
                    isClosing={closingTrades.has(trade.id)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
