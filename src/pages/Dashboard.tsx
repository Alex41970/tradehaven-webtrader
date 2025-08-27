import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { WebTrader } from "@/components/WebTrader";
import { Portfolio } from "@/components/Portfolio";
import { TradingHistory } from "@/components/TradingHistory";
import { LogOut, TrendingUp, DollarSign, Activity, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTrades } from "@/hooks/useTrades";
import { RealTimePriceService } from "@/services/RealTimePriceService";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { openTrades } = useTrades();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
  };

  // Calculate total P&L from open trades
  const totalUnrealizedPnL = openTrades.reduce((sum, trade) => sum + trade.pnl, 0);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading your trading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <RealTimePriceService>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">TradeHaven</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                onClick={() => navigate('/webtrader')}
                variant="default"
                size="sm"
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Launch WebTrader
              </Button>
              <Badge variant="outline" className="text-sm">
                <Activity className="w-3 h-3 mr-1" />
                Live Data
              </Badge>
              <span className="text-sm text-muted-foreground">Welcome, {user?.email}</span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-6">
          {/* Quick Stats */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Account Balance</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${profile?.balance.toFixed(2) || '0.00'}</div>
                <p className="text-xs text-muted-foreground">
                  Available Margin: ${profile?.available_margin.toFixed(2) || '0.00'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Trades</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{openTrades.length}</div>
                <p className="text-xs text-muted-foreground">
                  Used Margin: ${profile?.used_margin.toFixed(2) || '0.00'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unrealized P&L</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  totalUnrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Live P&L Updates
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Trading Interface */}
          <Tabs defaultValue="trader" className="space-y-4">
            <TabsList>
              <TabsTrigger value="trader">Web Trader</TabsTrigger>
              <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
              <TabsTrigger value="history">Trading History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="trader">
              <WebTrader />
            </TabsContent>
            
            <TabsContent value="portfolio">
              <Portfolio />
            </TabsContent>
            
            <TabsContent value="history">
              <TradingHistory />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </RealTimePriceService>
  );
};

export default Dashboard;