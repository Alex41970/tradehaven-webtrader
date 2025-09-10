import React, { useState, useMemo } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTrades } from "@/hooks/useTrades";
import { useAssets } from "@/hooks/useAssets";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { calculateRealTimePnL } from "@/utils/pnlCalculator";
import { useProfessionalMetrics, TimePeriod } from "@/hooks/usePerformanceMetrics";
import { useBotStatus } from "@/hooks/useBotStatus";
import { useTransactionHistory, TransactionHistory } from "@/hooks/useTransactionHistory";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

// New Components
import { ModernNavigation, NavigationTab } from "@/components/ModernNavigation";
import { HeroStatsCard } from "@/components/HeroStatsCard";
import { MetricsGrid } from "@/components/MetricsGrid";
import { PerformanceChart } from "@/components/PerformanceChart";
import { ModernTransactionHistory } from "@/components/ModernTransactionHistory";
import { PremiumCard, PremiumCardContent, PremiumCardHeader } from "@/components/PremiumCard";

// Existing Modals
import { TradingBotModal } from "@/components/TradingBotModal";
import { BotActiveView } from "@/components/BotActiveView";
import { DepositModal } from "@/components/DepositModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import { TransactionHistoryPopup } from "@/components/TransactionHistoryPopup";
import { WebTrader } from "@/components/WebTrader";
import { Portfolio } from "@/components/Portfolio";
import { TradingHistory } from "@/components/TradingHistory";

import { LogOut, TrendingUp, Settings, User, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const ModernDashboard = () => {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { trades, openTrades } = useTrades();
  const { assets, loading: assetsLoading } = useAssets();
  const { getUpdatedAssets } = useRealTimePrices();
  const { botStatus, activateLicense, pauseBot, resumeBot, disconnectBot } = useBotStatus();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  // Navigation state
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [timePeriod, setTimePeriod] = useState('January 2024 - May 2024');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Modal states
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

  // Event handlers (same as original)
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
    setShowBotFullScreen(true);
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

  // Create updated assets with real-time prices
  const updatedAssets = useMemo(() => {
    return getUpdatedAssets(assets);
  }, [assets, getUpdatedAssets]);

  // Calculate real-time total P&L from open trades
  const totalPnL = useMemo(() => {
    if (!openTrades || openTrades.length === 0) {
      return 0;
    }
    
    return openTrades.reduce((sum, trade) => {
      if (trade.status === 'closed') {
        return sum + (trade.pnl || 0);
      }

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

      return sum + (trade.pnl || 0);
    }, 0);
  }, [openTrades, updatedAssets]);

  // Calculate real-time equity: balance + unrealized P&L
  const realTimeEquity = useMemo(() => {
    return (profile?.balance || 0) + totalPnL;
  }, [profile?.balance, totalPnL]);

  // Calculate real-time used margin from all open trades
  const totalUsedMargin = useMemo(() => {
    if (!openTrades || openTrades.length === 0) {
      return 0;
    }
    return openTrades.reduce((sum, trade) => {
      return sum + (trade.margin_used || 0);
    }, 0);
  }, [openTrades]);

  // Calculate free margin: equity - used margin
  const freeMargin = useMemo(() => {
    return realTimeEquity - totalUsedMargin;
  }, [realTimeEquity, totalUsedMargin]);

  // Calculate margin level percentage
  const marginLevel = useMemo(() => {
    if (totalUsedMargin === 0) return 0;
    return (totalUsedMargin / realTimeEquity) * 100;
  }, [totalUsedMargin, realTimeEquity]);

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
          <p className="mt-4 text-muted-foreground">Loading your modern dashboard...</p>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            {/* Hero Stats Card */}
            <HeroStatsCard
              user={user}
              profile={profile}
              totalPnL={totalPnL}
              equity={realTimeEquity}
              marginLevel={marginLevel}
              onDepositClick={() => setShowDepositModal(true)}
              onWithdrawClick={() => setShowWithdrawModal(true)}
            />

            {/* Metrics Grid */}
            <MetricsGrid
              metrics={metrics}
              balance={profile?.balance || 0}
              totalPnL={totalPnL}
              equity={realTimeEquity}
              freeMargin={freeMargin}
              marginLevel={marginLevel}
            />

            {/* Performance Chart */}
            <PremiumCard glassmorphism glow>
              <PremiumCardHeader>
                <h3 className="text-xl font-bold font-playfair text-foreground">Account Performance</h3>
                <p className="text-sm text-muted-foreground">Portfolio equity growth over time</p>
              </PremiumCardHeader>
              <PremiumCardContent>
                <PerformanceChart
                  trades={trades}
                  initialBalance={10000}
                />
              </PremiumCardContent>
            </PremiumCard>

            {/* Transaction History */}
            <ModernTransactionHistory
              transactions={transactionHistory}
              onTransactionClick={handleTransactionClick}
              loading={transactionLoading}
            />
          </div>
        );
      
      case 'reports':
        return <TradingHistory />;
        
      case 'portfolio':
        return <Portfolio />;
        
      case 'analytics':
        return <WebTrader />;
        
      case 'settings':
        return (
          <PremiumCard glassmorphism>
            <PremiumCardContent className="p-8">
              <div className="text-center">
                <Settings className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-bold mb-2">Settings</h3>
                <p className="text-muted-foreground">Account settings and preferences coming soon.</p>
              </div>
            </PremiumCardContent>
          </PremiumCard>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background font-inter">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold font-playfair">TradeHaven</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {isMobile ? (
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-80">
                    <SheetHeader>
                      <SheetTitle className="flex items-center space-x-2">
                        <User className="h-5 w-5" />
                        <span>Account Menu</span>
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      <div className="border-b pb-4">
                        <p className="text-sm text-muted-foreground">Welcome back</p>
                        <p className="font-medium truncate">{user?.email}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground" 
                        onClick={handleSignOut} 
                        disabled={signingOut}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        {signingOut ? "Signing Out..." : "Sign Out"}
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground hidden lg:inline">Welcome, {user?.email}</span>
                  <Button variant="outline" size="sm" onClick={handleSignOut} disabled={signingOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    {signingOut ? "Signing Out..." : "Sign Out"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Modern Navigation */}
      <ModernNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        timePeriod={timePeriod}
        onTimePeriodChange={setTimePeriod}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {renderTabContent()}
      </main>

      {/* All Modals (same as original) */}
      <TradingBotModal
        isOpen={botModalOpen}
        onClose={() => setBotModalOpen(false)}
        onActivate={handleLicenseActivate}
        showPermissions={showPermissions}
        onAcceptPermissions={handleAcceptPermissions}
        isConnected={botStatus.isConnected}
      />

      <DepositModal
        open={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={refetchProfile}
      />

      <WithdrawModal
        open={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={refetchProfile}
        availableBalance={profile?.balance || 0}
      />

      {selectedTransaction && (
        <TransactionHistoryPopup
          isOpen={showTransactionPopup}
          onClose={handleCloseTransactionPopup}
          transaction={selectedTransaction}
        />
      )}
    </div>
  );
};

export default ModernDashboard;
