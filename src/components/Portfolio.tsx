
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrades } from "@/hooks/useTrades";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAssets } from "@/hooks/useAssets";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, AlertTriangle } from "lucide-react";
import { useMemo, useEffect, useState, useCallback } from "react";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TradeRow } from "@/components/TradeRow";
import { calculateRealTimePnL } from "@/utils/pnlCalculator";

export const Portfolio = () => {
  // ALL HOOKS MUST BE CALLED FIRST - NO CONDITIONAL HOOK CALLS
  const { user } = useAuth();
  const { openTrades, closeTrade, loading: tradesLoading } = useTrades();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { assets, loading: assetsLoading } = useAssets();
  const { toast } = useToast();
  const { getUpdatedAssets } = useRealTimePrices();
  const [closingTrades, setClosingTrades] = useState<Set<string>>(new Set());

  // ALL useMemo hooks must be called here, before any conditional logic
  const updatedAssets = useMemo(() => {
    if (!assets || assets.length === 0) {
      return [];
    }
    try {
      return getUpdatedAssets(assets);
    } catch (error) {
      console.error('Error getting updated assets:', error);
      return assets;
    }
  }, [assets, getUpdatedAssets]);

  const totalPnL = useMemo(() => {
    if (!openTrades || openTrades.length === 0) {
      return 0;
    }
    
    // Calculate real-time P&L for each open trade
    return openTrades.reduce((sum, trade) => {
      // If trade is closed, use stored P&L
      if (trade.status === 'closed') {
        return sum + (trade.pnl || 0);
      }

      // For open trades, calculate real-time P&L if current price is available
      const asset = updatedAssets.find(a => a.symbol === trade.symbol);
      if (asset?.price) {
        const realTimePnL = calculateRealTimePnL(
          {
            trade_type: trade.trade_type,
            amount: trade.amount,
            open_price: trade.open_price,
            leverage: trade.leverage
          },
          asset.price
        );
        return sum + realTimePnL;
      }

      // Fall back to stored P&L if no real-time price
      return sum + (trade.pnl || 0);
    }, 0);
  }, [openTrades, updatedAssets]);

  // Calculate risk metrics
  const riskMetrics = useMemo(() => {
    if (!profile || !openTrades) {
      return { marginUtilization: 0, largestExposure: 0, riskLevel: 'Low' as const };
    }

    const totalMargin = profile.available_margin + profile.used_margin;
    const marginUtilization = totalMargin > 0 ? (profile.used_margin / totalMargin) * 100 : 0;
    
    const largestExposure = openTrades.reduce((max, trade) => {
      const exposure = trade.amount * (trade.leverage || 1);
      return Math.max(max, exposure);
    }, 0);

    let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
    if (marginUtilization > 70) riskLevel = 'High';
    else if (marginUtilization > 40) riskLevel = 'Medium';

    return { marginUtilization, largestExposure, riskLevel };
  }, [profile, openTrades]);

  // ALL useCallback hooks must be called here, before any conditional logic
  const handleCloseTrade = useCallback(async (tradeId: string, symbol: string) => {
    // Prevent multiple close attempts
    if (closingTrades.has(tradeId)) {
      console.log('Trade already being closed:', tradeId);
      return;
    }

    setClosingTrades(prev => new Set(prev).add(tradeId));

    try {
      const asset = updatedAssets.find(a => a.symbol === symbol);
      if (!asset) {
        console.error(`Asset not found for symbol: ${symbol}`);
        toast({
          title: "Error",
          description: "Asset not found for current price",
          variant: "destructive",
        });
        return;
      }

      if (!asset.price || isNaN(asset.price)) {
        console.error(`Invalid price for asset ${symbol}:`, asset.price);
        toast({
          title: "Error",
          description: "Invalid asset price",
          variant: "destructive",
        });
        return;
      }

      console.log('Closing trade in Portfolio:', tradeId, 'at price:', asset.price);
      const success = await closeTrade(tradeId, asset.price);
      
      if (success) {
        console.log('Trade closed successfully from Portfolio');
        // Database triggers will automatically handle margin recalculation
        // Trade will be removed from openTrades automatically via real-time updates
      } else {
        toast({
          title: "Error",
          description: "Failed to close trade",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error closing trade:', error);
      toast({
        title: "Error",
        description: "An error occurred while closing the trade",
        variant: "destructive",
      });
    } finally {
      setClosingTrades(prev => {
        const newSet = new Set(prev);
        newSet.delete(tradeId);
        return newSet;
      });
    }
  }, [updatedAssets, closeTrade, toast]);

  // Listen for real-time user profile updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('portfolio-profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          console.log('Profile updated in Portfolio, refreshing data...');
          refetchProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetchProfile]);

  // NOW we can do conditional rendering AFTER all hooks are called
  const isLoading = tradesLoading || profileLoading || assetsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
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
