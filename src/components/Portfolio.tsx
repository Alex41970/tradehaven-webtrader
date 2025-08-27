
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAssets } from "@/hooks/useAssets";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { SimplePriceIndicator } from "@/components/SimplePriceIndicator";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";

export const Portfolio = () => {
  // ALL HOOKS MUST BE CALLED FIRST - NO CONDITIONAL HOOK CALLS
  const { openTrades, closeTrade, loading: tradesLoading } = useTrades();
  const { profile, loading: profileLoading } = useUserProfile();
  const { assets, loading: assetsLoading } = useAssets();
  const { toast } = useToast();
  const { getUpdatedAssets } = useRealTimePrices();

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
    return openTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
  }, [openTrades]);

  // NOW we can do conditional rendering AFTER all hooks are called
  const isLoading = tradesLoading || profileLoading || assetsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const handleCloseTrade = async (tradeId: string, symbol: string) => {
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

      const success = await closeTrade(tradeId, asset.price);
      if (success) {
        toast({
          title: "Success",
          description: "Trade closed successfully",
        });
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
    }
  };

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
                try {
                  const asset = updatedAssets.find(a => a.symbol === trade.symbol);
                  const currentPrice = asset?.price || trade.current_price || trade.open_price || 0;
                  const change24h = asset?.change_24h || 0;
                  
                  return (
                    <div key={trade.id} className="border rounded-lg p-4">
                      <div className="grid md:grid-cols-8 gap-3 items-center text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Symbol</div>
                          <div className="font-medium">{trade.symbol}</div>
                          <Badge variant={trade.trade_type === "BUY" ? "default" : "destructive"} className="text-xs mt-1">
                            {trade.trade_type}
                          </Badge>
                        </div>
                        
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Amount</div>
                          <div className="font-medium">${Number(trade.amount).toFixed(2)}</div>
                        </div>
                        
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Open Price</div>
                          <div className="font-mono">{Number(trade.open_price).toFixed(trade.symbol.includes('JPY') ? 2 : 4)}</div>
                        </div>
                        
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Current Price</div>
                          {asset && asset.price ? (
                            <SimplePriceIndicator 
                              price={currentPrice}
                              symbol={trade.symbol}
                            />
                          ) : (
                            <div className="font-mono">
                              {currentPrice.toFixed(trade.symbol.includes('JPY') ? 2 : 4)}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="text-xs text-muted-foreground mb-1">24h Change</div>
                          <div className={`flex items-center gap-1 ${change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {change24h >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <span className="font-mono text-xs">
                              {change24h >= 0 ? '+' : ''}{change24h.toFixed(trade.symbol.includes('JPY') ? 2 : 4)}
                            </span>
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">P&L</div>
                          <div className={`font-medium flex items-center gap-1 ${(trade.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(trade.pnl || 0) >= 0 ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            <span>{(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(2)}</span>
                          </div>
                        </div>
                        
                        <div className="col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Action</div>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleCloseTrade(trade.id, trade.symbol)}
                            className="w-full"
                          >
                            Close Position
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                } catch (error) {
                  console.error('Error rendering trade:', error, trade);
                  return (
                    <div key={trade.id} className="border rounded-lg p-4 bg-red-50 dark:bg-red-950/20">
                      <div className="text-red-600 text-sm">
                        Error loading trade data for {trade.symbol}
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
