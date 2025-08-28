import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { WebTrader } from "@/components/WebTrader";
import { Portfolio } from "@/components/Portfolio";
import { TradingHistory } from "@/components/TradingHistory";
import { LogOut, TrendingUp, DollarSign, Activity, ExternalLink, Shield, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTrades } from "@/hooks/useTrades";
import { useAssets } from "@/hooks/useAssets";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { calculateRealTimePnL } from "@/utils/pnlCalculator";
import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { openTrades } = useTrades();
  const { assets, loading: assetsLoading } = useAssets();
  const { getUpdatedAssets } = useRealTimePrices();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      setSigningOut(false);
    }
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

  if (profileLoading || assetsLoading) {
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Trades</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{openTrades.length}</div>
                <p className="text-xs text-muted-foreground">
                  Active positions
                </p>
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
  );
};

export default Dashboard;