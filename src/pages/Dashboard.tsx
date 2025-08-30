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
import { TransactionHistoryPopup } from "@/components/TransactionHistoryPopup";
import { LogOut, TrendingUp, DollarSign, Activity, ExternalLink, Plus, Minus, BarChart3, Target, Trophy, Shield, TrendingDown, Zap, Award, Bot, History, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle, Loader } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTrades } from "@/hooks/useTrades";
import { useAssets } from "@/hooks/useAssets";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { calculateRealTimePnL } from "@/utils/pnlCalculator";
import { formatLargeNumber, getResponsiveTextSize, formatPercentage } from "@/utils/numberFormatter";
import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfessionalMetrics, TimePeriod } from "@/hooks/usePerformanceMetrics";
import { useBotStatus } from "@/hooks/useBotStatus";
import { useTransactionHistory, TransactionHistory } from "@/hooks/useTransactionHistory";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionHistory | null>(null);
  const [showTransactionPopup, setShowTransactionPopup] = useState(false);
  
  // Performance metrics
  const { metrics, selectedPeriod, setSelectedPeriod } = useProfessionalMetrics(trades, profile?.balance || 10000);
  
  // Transaction history
  const { transactionHistory, loading: transactionLoading } = useTransactionHistory();

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

  const handleTransactionClick = (transaction: TransactionHistory) => {
    setSelectedTransaction(transaction);
    setShowTransactionPopup(true);
  };

  const handleCloseTransactionPopup = () => {
    setShowTransactionPopup(false);
    setSelectedTransaction(null);
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
            <Card className="bg-gradient-to-br from-card via-card to-card/95 border-2 border-primary/10 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-foreground">
                        {profile?.first_name && profile?.surname 
                          ? `${profile.first_name} ${profile.surname}`
                          : 'Account Holder'
                        }
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-1">
                        Premium Trading Account • ID: {user?.id?.slice(-8).toUpperCase()}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                    <Shield className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Account Balance Section */}
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Total Account Balance</span>
                      <Trophy className="h-4 w-4 text-primary" />
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`font-bold text-foreground mb-1 min-w-0 ${getResponsiveTextSize(profile?.balance || 0, 'text-3xl')}`}>
                            {(() => {
                              const formatted = formatLargeNumber(profile?.balance || 0);
                              return formatted.display;
                            })()}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{formatLargeNumber(profile?.balance || 0).full}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="text-xs text-muted-foreground">
                      Last updated: {new Date().toLocaleTimeString()}
                    </div>
                  </div>

                  {/* Margin Details Section */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-lg p-3 border">
                      <div className="flex items-center space-x-2 mb-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span className="text-xs font-medium text-muted-foreground">Available</span>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`font-bold text-foreground min-w-0 ${getResponsiveTextSize(profile?.available_margin || 0, 'text-lg')}`}>
                              {formatLargeNumber(profile?.available_margin || 0).display}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{formatLargeNumber(profile?.available_margin || 0).full}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <div className="text-xs text-muted-foreground">
                        {profile?.balance ? formatPercentage((profile.available_margin / profile.balance) * 100) : '0.0%'} free
                      </div>
                    </div>
                    
                    <div className="bg-muted/30 rounded-lg p-3 border">
                      <div className="flex items-center space-x-2 mb-1">
                        <Activity className="h-3 w-3 text-orange-500" />
                        <span className="text-xs font-medium text-muted-foreground">In Use</span>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`font-bold text-foreground min-w-0 ${getResponsiveTextSize(profile?.used_margin || 0, 'text-lg')}`}>
                              {formatLargeNumber(profile?.used_margin || 0).display}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{formatLargeNumber(profile?.used_margin || 0).full}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <div className="text-xs text-muted-foreground">
                        {profile?.balance ? formatPercentage((profile.used_margin / profile.balance) * 100) : '0.0%'} utilized
                      </div>
                    </div>
                  </div>

                  {/* Margin Level Indicator */}
                  <div className="bg-muted/20 rounded-lg p-3 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Margin Level</span>
                      <span className={`text-xs font-bold ${
                        profile?.used_margin && profile?.balance && (profile.balance / profile.used_margin) > 2 
                          ? 'text-green-500' 
                          : profile?.used_margin && profile?.balance && (profile.balance / profile.used_margin) > 1.5
                          ? 'text-yellow-500'
                          : 'text-red-500'
                      }`}>
                        {profile?.used_margin && profile?.used_margin > 0 && profile?.balance 
                          ? formatPercentage((profile.balance / profile.used_margin) * 100, 0)
                          : '∞'
                        }
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          profile?.used_margin && profile?.balance && (profile.balance / profile.used_margin) > 2
                            ? 'bg-green-500'
                            : profile?.used_margin && profile?.balance && (profile.balance / profile.used_margin) > 1.5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: profile?.used_margin && profile?.used_margin > 0 && profile?.balance
                            ? `${Math.min((profile.balance / profile.used_margin) * 10, 100)}%`
                            : '100%'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Account Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

                {/* Transaction History Section */}
                <div className="border-t pt-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Recent Transactions</span>
                  </div>
                  
                  {transactionLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : transactionHistory.length > 0 ? (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {transactionHistory.slice(0, 5).map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleTransactionClick(transaction)}
                        >
                          <div className="flex items-center space-x-2">
                            {transaction.type === 'deposit' ? (
                              <ArrowDownLeft className="h-3 w-3 text-green-500" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3 text-blue-500" />
                            )}
                            <div>
                              <p className="text-xs font-medium capitalize">{transaction.type}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {formatLargeNumber(transaction.amount).display}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs px-1.5 py-0.5 ${
                                transaction.status === 'approved' 
                                  ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                                  : transaction.status === 'rejected'
                                  ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                  : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                              }`}
                            >
                              {transaction.status === 'approved' ? (
                                <CheckCircle className="h-2 w-2 mr-1" />
                              ) : transaction.status === 'rejected' ? (
                                <XCircle className="h-2 w-2 mr-1" />
                              ) : (
                                <Clock className="h-2 w-2 mr-1" />
                              )}
                              {transaction.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-muted-foreground">No transactions yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Performance Metrics</CardTitle>
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
                
                <div className="space-y-2 max-h-64 overflow-y-auto pr-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <BarChart3 className="w-3 h-3 mr-1" />
                      Total Trades
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {metrics.totalTrades}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <Trophy className="w-3 h-3 mr-1" />
                      Win/Loss Ratio
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {metrics.profitableTrades}W/{metrics.losingTrades}L
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Largest Win
                    </span>
                    <span className="text-sm font-medium text-trading-success">
                      ${metrics.largestWin.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <TrendingDown className="w-3 h-3 mr-1" />
                      Largest Loss
                    </span>
                    <span className="text-sm font-medium text-trading-danger">
                      ${Math.abs(metrics.largestLoss).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <Zap className="w-3 h-3 mr-1" />
                      Current Streak
                    </span>
                    <span className={`text-sm font-medium ${
                      metrics.consecutiveWins > 0 ? 'text-trading-success' : 
                      metrics.consecutiveLosses > 0 ? 'text-trading-danger' : 'text-muted-foreground'
                    }`}>
                      {metrics.consecutiveWins > 0 ? `${metrics.consecutiveWins}W` : 
                       metrics.consecutiveLosses > 0 ? `${metrics.consecutiveLosses}L` : 'None'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <Award className="w-3 h-3 mr-1" />
                      Period Return
                    </span>
                    <span className={`text-sm font-medium ${metrics.periodReturn >= 0 ? 'text-trading-success' : 'text-trading-danger'}`}>
                      {metrics.periodReturn >= 0 ? '+' : ''}${metrics.periodReturn.toFixed(2)}
                    </span>
                  </div>
                  
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
                    <span className={`text-sm font-medium ${metrics.winRate >= 60 ? 'text-trading-success' : metrics.winRate >= 40 ? 'text-yellow-500' : 'text-trading-danger'}`}>
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

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <Activity className="w-3 h-3 mr-1" />
                      Current Drawdown
                    </span>
                    <span className={`text-sm font-medium ${metrics.currentDrawdownPercent <= 5 ? 'text-trading-success' : metrics.currentDrawdownPercent <= 15 ? 'text-yellow-500' : 'text-trading-danger'}`}>
                      -{metrics.currentDrawdownPercent.toFixed(1)}%
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

        {/* Transaction History Popup */}
        <TransactionHistoryPopup
          transaction={selectedTransaction}
          isOpen={showTransactionPopup}
          onClose={handleCloseTransactionPopup}
        />
      </div>
  );
};

export default Dashboard;