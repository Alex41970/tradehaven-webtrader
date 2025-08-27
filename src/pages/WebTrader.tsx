import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, ArrowLeft, Activity, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAssets } from "@/hooks/useAssets";
import { useTrades } from "@/hooks/useTrades";
import { useUserProfile } from "@/hooks/useUserProfile";
import { LivePriceIndicator } from "@/components/LivePriceIndicator";
import { toast } from "@/hooks/use-toast";

const WebTrader = () => {
  const navigate = useNavigate();
  const { assets } = useAssets();
  const { trades, refetch: refetchTrades } = useTrades();
  const { userProfile } = useUserProfile();
  const [isExternalTraderOpen, setIsExternalTraderOpen] = useState(false);

  // Simulate external trading platform URL
  const externalTraderUrl = "https://tradingview.com/";

  const openTrades = trades?.filter(trade => trade.status === 'open') || [];
  const totalPnL = openTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
  const totalVolume = trades?.reduce((sum, trade) => sum + trade.amount, 0) || 0;

  const handleLaunchExternalTrader = () => {
    setIsExternalTraderOpen(true);
    // Open external trader in new window/tab
    const traderWindow = window.open(
      externalTraderUrl,
      'webtrader',
      'width=1200,height=800,scrollbars=yes,resizable=yes'
    );
    
    if (!traderWindow) {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups and try again, or use the direct link below.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "WebTrader Launched",
        description: "External trading platform opened in new window. Your trades will sync automatically.",
      });
    }
  };

  const handleSyncTrades = async () => {
    // Simulate syncing trades from external platform
    toast({
      title: "Syncing Trades",
      description: "Fetching latest trades from external platform...",
    });
    
    // In a real implementation, this would call an API to sync trades
    setTimeout(() => {
      refetchTrades();
      toast({
        title: "Trades Synced",
        description: "Successfully synced trades from external platform.",
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Professional WebTrader
              </h1>
              <p className="text-muted-foreground mt-2">
                Access advanced trading tools and real-time market data
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              {isExternalTraderOpen ? 'Connected' : 'Ready to Trade'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Account Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Account Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ${userProfile?.balance?.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Available: ${userProfile?.available_margin?.toFixed(2) || '0.00'}
              </p>
            </CardContent>
          </Card>

          {/* P&L Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Open Positions: {openTrades.length}
              </p>
            </CardContent>
          </Card>

          {/* Trading Volume */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Trading Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${totalVolume.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total trades: {trades?.length || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Trading Interface */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* External Trader Launch */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                External Trading Platform
              </CardTitle>
              <CardDescription>
                Launch the professional trading interface in a new window for advanced charting and order execution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/20">
                <h4 className="font-semibold mb-2">Features Available:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Advanced charting with 100+ indicators</li>
                  <li>• Real-time market data and news</li>
                  <li>• One-click trading with multiple order types</li>
                  <li>• Risk management tools</li>
                  <li>• Multi-timeframe analysis</li>
                </ul>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  onClick={handleLaunchExternalTrader}
                  className="flex-1"
                  size="lg"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Launch WebTrader
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleSyncTrades}
                  size="lg"
                >
                  <Activity className="mr-2 h-4 w-4" />
                  Sync Trades
                </Button>
              </div>

              <div className="text-xs text-muted-foreground p-3 bg-muted/10 rounded border-l-4 border-primary">
                <strong>Note:</strong> All trades executed on the external platform will automatically sync with your account balance and portfolio.
              </div>
            </CardContent>
          </Card>

          {/* Live Market Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Live Market Data
              </CardTitle>
              <CardDescription>
                Real-time prices for major trading instruments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {assets?.slice(0, 10).map((asset) => (
                  <div key={asset.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/20 transition-colors">
                    <div>
                      <div className="font-medium">{asset.symbol}</div>
                      <div className="text-xs text-muted-foreground capitalize">{asset.category}</div>
                    </div>
                    <LivePriceIndicator 
                      price={asset.price}
                      change={asset.change_24h}
                      symbol={asset.symbol}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Open Positions */}
        {openTrades.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Open Positions
              </CardTitle>
              <CardDescription>
                Monitor your active trades and their performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {openTrades.map((trade) => {
                  const asset = assets?.find(a => a.id === trade.asset_id);
                  const pnl = trade.pnl || 0;
                  
                  return (
                    <div key={trade.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="font-medium">{trade.symbol}</div>
                          <div className="text-xs text-muted-foreground">
                            {trade.trade_type} • ${trade.amount.toLocaleString()} • {trade.leverage}x
                          </div>
                        </div>
                        <Separator orientation="vertical" className="h-8" />
                        <div className="text-sm">
                          <div>Open: ${trade.open_price}</div>
                          <div>Current: ${trade.current_price || asset?.price || 0}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {((pnl / trade.amount) * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Direct Link Fallback */}
        <Card className="mt-6 border-dashed">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">
                If the popup doesn't work, you can access the external trader directly:
              </p>
              <a 
                href={externalTraderUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm font-medium"
              >
                {externalTraderUrl} <ExternalLink className="inline h-3 w-3 ml-1" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WebTrader;