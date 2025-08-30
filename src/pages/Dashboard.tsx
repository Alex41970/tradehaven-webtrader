import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { WebTrader } from "@/components/WebTrader";
import { Portfolio } from "@/components/Portfolio";
import { TradingHistory } from "@/components/TradingHistory";
import { TradingBotModal } from "@/components/TradingBotModal";
import { BotActiveView } from "@/components/BotActiveView";
import { DepositModal } from "@/components/DepositModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import { LogOut, TrendingUp, DollarSign, Activity, ExternalLink, Plus, Minus, BarChart3, Target, Trophy, Shield, TrendingDown, Zap, Award, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTrades } from "@/hooks/useTrades";
import { useAssets } from "@/hooks/useAssets";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { calculateRealTimePnL } from "@/utils/pnlCalculator";
import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfessionalMetrics, TimePeriod } from "@/hooks/usePerformanceMetrics";
import { useBotStatus } from "@/hooks/useBotStatus";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { trades, openTrades } = useTrades();
  const { assets, loading: assetsLoading } = useAssets();
  const { getUpdatedAssets } = useRealTimePrices();
  const { botStatus, activateLicense, pauseBot, resumeBot, disconnectBot } = useBotStatus();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [botModalOpen, setBotModalOpen] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showBotFullScreen, setShowBotFullScreen] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  
  // Performance metrics
  const { metrics, selectedPeriod, setSelectedPeriod } = useProfessionalMetrics(trades, profile?.balance || 10000);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      setSigningOut(false);
    }
  };

  const handleBotConnect = () => {
    setBotModalOpen(true);
  };

  const handleLicenseActivate = async (licenseKey: string) => {
    const success = await activateLicense(licenseKey);
    if (success) {
      setBotModalOpen(false);
      setShowPermissions(true);
    }
    return success;
  };

  const handleAcceptPermissions = () => {
    setShowPermissions(false);
  };

  const handleBotDelete = () => {
    disconnectBot();
    setShowBotFullScreen(true); // Reset to full screen for next connection
  };

  const handleBackToDashboard = () => {
    setShowBotFullScreen(false);
  };

  // Listen for real-time user profile updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Refetch profile when it's updated
          refetchProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetchProfile]);

  // Create updated assets with real-time prices
  const updatedAssets = useMemo(() => {
    return getUpdatedAssets(assets);
  }, [assets, getUpdatedAssets]);

  // Show bot interface if connected and in full screen mode
  if (botStatus.isConnected && !botStatus.loading && showBotFullScreen) {
    return (
      <BotActiveView
        botStatus={botStatus.botStatus}
        onPause={pauseBot}
        onResume={resumeBot}
        onDelete={handleBotDelete}
        onBackToDashboard={handleBackToDashboard}
      />
    );
  }

  if (profileLoading || assetsLoading || botStatus.loading) {
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
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">TradeHaven</h1>
            </div>
            <div className="flex items-center space-x-4">
              {botStatus.isConnected && !showBotFullScreen ? (
                <Button 
                  onClick={() => setShowBotFullScreen(true)}
                  variant="outline"
                  size="sm"
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <Bot className="w-4 h-4 mr-2" />
                  <Activity className="w-3 h-3 mr-1" />
                  Bot {botStatus.botStatus === 'active' ? 'Active' : 'Paused'}
                </Button>
              ) : !botStatus.isConnected ? (
                <Button 
                  onClick={handleBotConnect}
                  variant="default"
                  size="sm"
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  <Bot className="w-4 h-4 mr-2" />
                  Connect Your Trading Bot
                </Button>
              ) : null}
              <Badge variant="outline" className="text-sm">
                <Activity className="w-3 h-3 mr-1" />
                Live Data
              </Badge>
              <span className="text-sm text-muted-foreground">Welcome, {user?.email}</span>
              <Button variant="outline" size="sm" onClick={handleSignOut} disabled={signingOut}>
                <LogOut className="h-4 w-4 mr-2" />
                {signingOut ? "Signing Out..." : "Sign Out"}
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
                <p className="text-xs text-muted-foreground">
                  Used Margin: ${profile?.used_margin.toFixed(2) || '0.00'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Account Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => setShowDepositModal(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Deposit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => setShowWithdrawModal(true)}
                  >
                    <Minus className="h-4 w-4 mr-2" />
                    Withdraw
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Performance</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-4">
                <ToggleGroup 
                  type="single" 
                  value={selectedPeriod} 
                  onValueChange={(value: TimePeriod) => value && setSelectedPeriod(value)}
                  className="grid grid-cols-5 gap-1"
                >
                  <ToggleGroupItem value="daily" variant="outline" size="sm" className="text-xs">
                    1D
                  </ToggleGroupItem>
                  <ToggleGroupItem value="weekly" variant="outline" size="sm" className="text-xs">
                    7D
                  </ToggleGroupItem>
                  <ToggleGroupItem value="monthly" variant="outline" size="sm" className="text-xs">
                    1M
                  </ToggleGroupItem>
                  <ToggleGroupItem value="yearly" variant="outline" size="sm" className="text-xs">
                    1Y
                  </ToggleGroupItem>
                  <ToggleGroupItem value="all-time" variant="outline" size="sm" className="text-xs">
                    All
                  </ToggleGroupItem>
                </ToggleGroup>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <BarChart3 className="w-3 h-3 mr-1" />
                      Profit Factor
                    </span>
                    <span className={`text-sm font-medium ${metrics.profitFactor >= 1.5 ? 'text-trading-success' : metrics.profitFactor >= 1.0 ? 'text-yellow-500' : 'text-trading-danger'}`}>
                      {metrics.profitFactor.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <Shield className="w-3 h-3 mr-1" />
                      Sharpe Ratio
                    </span>
                    <span className={`text-sm font-medium ${metrics.sharpeRatio >= 1.0 ? 'text-trading-success' : metrics.sharpeRatio >= 0 ? 'text-yellow-500' : 'text-trading-danger'}`}>
                      {metrics.sharpeRatio.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <TrendingDown className="w-3 h-3 mr-1" />
                      Max Drawdown
                    </span>
                    <span className="text-sm font-medium text-trading-danger">
                      -{metrics.maximumDrawdownPercent.toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <Target className="w-3 h-3 mr-1" />
                      Win Rate
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      {metrics.winRate.toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <Zap className="w-3 h-3 mr-1" />
                      Expectancy
                    </span>
                    <span className={`text-sm font-medium ${metrics.expectancy >= 0 ? 'text-trading-success' : 'text-trading-danger'}`}>
                      ${metrics.expectancy.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <Award className="w-3 h-3 mr-1" />
                      Recovery Factor
                    </span>
                    <span className={`text-sm font-medium ${metrics.recoveryFactor >= 2.0 ? 'text-trading-success' : metrics.recoveryFactor >= 1.0 ? 'text-yellow-500' : 'text-trading-danger'}`}>
                      {metrics.recoveryFactor.toFixed(2)}
                    </span>
                  </div>
                </div>
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

        {/* Trading Bot Modal */}
        <TradingBotModal
          isOpen={botModalOpen}
          onClose={() => setBotModalOpen(false)}
          onActivate={handleLicenseActivate}
          onAcceptPermissions={handleAcceptPermissions}
          showPermissions={showPermissions}
        />

        {/* Deposit Modal */}
        <DepositModal 
          open={showDepositModal} 
          onOpenChange={setShowDepositModal}
        />

        {/* Withdraw Modal */}
        <WithdrawModal 
          open={showWithdrawModal} 
          onOpenChange={setShowWithdrawModal}
        />
      </div>
  );
};

export default Dashboard;