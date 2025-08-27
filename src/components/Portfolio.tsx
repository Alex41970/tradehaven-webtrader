
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTrades } from "@/hooks/useTrades";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAssets } from "@/hooks/useAssets";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useMemo, useEffect, useState, useCallback } from "react";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TradeRow } from "@/components/TradeRow";

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
    // Use the stored P&L from database instead of calculating real-time
    return openTrades.reduce((sum, trade) => {
      return sum + (trade.pnl || 0);
    }, 0);
  }, [openTrades]);

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
          <CardHeader>
            <CardTitle className="text-lg">Used Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${profile?.used_margin?.toFixed(2) || '0.00'}</div>
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
