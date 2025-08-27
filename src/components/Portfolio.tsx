import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAssets } from "@/hooks/useAssets";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export const Portfolio = () => {
  const { openTrades, closeTrade, loading: tradesLoading } = useTrades();
  const { profile, loading: profileLoading } = useUserProfile();
  const { assets } = useAssets();
  const { toast } = useToast();

  if (tradesLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const totalPnL = openTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);

  const handleCloseTrade = async (tradeId: string, symbol: string) => {
    const asset = assets.find(a => a.symbol === symbol);
    if (!asset) {
      toast({
        title: "Error",
        description: "Asset not found for current price",
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
            <div className="text-2xl font-bold">{openTrades.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
          {openTrades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No open positions
            </div>
          ) : (
            <div className="space-y-4">
              {openTrades.map((trade) => {
                const asset = assets.find(a => a.symbol === trade.symbol);
                const currentPrice = asset?.price || trade.current_price || trade.open_price;
                
                return (
                  <div key={trade.id} className="border rounded-lg p-4">
                    <div className="grid md:grid-cols-6 gap-4 items-center">
                      <div>
                        <div className="font-medium">{trade.symbol}</div>
                        <Badge variant={trade.trade_type === "BUY" ? "default" : "destructive"}>
                          {trade.trade_type}
                        </Badge>
                      </div>
                      
                      <div>
                        <div className="text-sm text-muted-foreground">Amount</div>
                        <div className="font-medium">${trade.amount}</div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-muted-foreground">Open Price</div>
                        <div className="font-mono">{Number(trade.open_price).toFixed(trade.symbol.includes('JPY') ? 2 : 4)}</div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-muted-foreground">Current Price</div>
                        <div className="font-mono">{Number(currentPrice).toFixed(trade.symbol.includes('JPY') ? 2 : 4)}</div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-muted-foreground">P&L</div>
                        <div className={`font-medium flex items-center ${(trade.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(trade.pnl || 0) >= 0 ? (
                            <TrendingUp className="h-4 w-4 mr-1" />
                          ) : (
                            <TrendingDown className="h-4 w-4 mr-1" />
                          )}
                          {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(2)}
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleCloseTrade(trade.id, trade.symbol)}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};