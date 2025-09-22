import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TradingChart } from "./TradingChart";
import { TradeRow } from "./TradeRow";
import { TradingTabsInterface } from "./TradingTabsInterface";
import { FloatingActionButton } from "./FloatingActionButton";
import { Star, StarIcon, TrendingUp, TrendingDown, Menu, Wallet, History, ArrowLeft } from "lucide-react";
import { useAssets } from "@/hooks/useAssets";
import { useTrades } from "@/hooks/useTrades";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useFavorites } from "@/hooks/useFavorites";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { useTradeOrders } from "@/hooks/useTradeOrders";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";
import { PulsingPriceIndicator } from "./PulsingPriceIndicator";
import { PriceConnectionStatus } from "./PriceConnectionStatus";

export const WebTrader = () => {
  const { assets, loading: assetsLoading } = useAssets();
  const { openTrade, closeTrade, openTrades, loading: tradesLoading } = useTrades();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useUserProfile();
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const { getUpdatedAssets, isConnected, lastUpdate } = useRealTimePrices();
  const { createOrder } = useTradeOrders();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [amount, setAmount] = useState(1);
  const [leverage, setLeverage] = useState(100);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isExecuting, setIsExecuting] = useState(false);

  // Get real-time price updates for assets
  const realtimeAssets = useMemo(() => {
    return getUpdatedAssets(assets);
  }, [assets, getUpdatedAssets]);

  // Filter assets based on search and category
  const filteredAssets = useMemo(() => {
    return realtimeAssets.filter(asset => {
      const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          asset.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "all" || asset.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [realtimeAssets, searchTerm, categoryFilter]);

  // Get favorite assets with real-time prices
  const favoriteAssets = useMemo(() => {
    const favoriteIds = favorites.map(f => f.asset_id);
    return realtimeAssets.filter(asset => favoriteIds.includes(asset.id));
  }, [realtimeAssets, favorites]);

  // Auto-select first asset if none selected
  useEffect(() => {
    if (!selectedAsset && realtimeAssets.length > 0) {
      setSelectedAsset(realtimeAssets[0]);
    }
  }, [realtimeAssets, selectedAsset]);

  // Update selected asset with real-time data - REMOVED selectedAsset from dependencies to prevent infinite loop
  useEffect(() => {
    if (selectedAsset) {
      const updatedAsset = realtimeAssets.find(a => a.id === selectedAsset.id);
      if (updatedAsset && (
        updatedAsset.price !== selectedAsset.price || 
        updatedAsset.change_24h !== selectedAsset.change_24h ||
        updatedAsset.updated_at !== selectedAsset.updated_at
      )) {
        setSelectedAsset(updatedAsset);
      }
    }
  }, [realtimeAssets]); // Removed selectedAsset from dependencies

  // Real-time updates are now handled by WebSocket system, no need for Supabase subscriptions

  // Calculate margin required
  const calculateMargin = useMemo(() => {
    if (!selectedAsset) return 0;
    
    if (selectedAsset.category === 'forex') {
      return (selectedAsset.contract_size * selectedAsset.price) / leverage;
    } else {
      return (amount * selectedAsset.price) / leverage;
    }
  }, [selectedAsset, amount, leverage]);

  // Calculate position size
  const calculatePositionSize = useMemo(() => {
    if (!selectedAsset) return 0;
    
    if (selectedAsset.category === 'forex') {
      return selectedAsset.contract_size * leverage;
    } else {
      return amount * selectedAsset.price * leverage;
    }
  }, [selectedAsset, amount, leverage]);

  const handleTrade = async (tradeType: 'BUY' | 'SELL') => {
    if (!selectedAsset || !profile) return;
    
    // For forex, use 1 as amount since it's a fixed lot size
    const tradeAmount = selectedAsset.category === 'forex' ? 1 : amount;
    
    if (tradeAmount < selectedAsset.min_trade_size) {
      toast({
        title: "Invalid Trade Size",
        description: `Minimum trade size is ${selectedAsset.min_trade_size}`,
        variant: "destructive",
      });
      return;
    }

    if (profile.available_margin < calculateMargin) {
      toast({
        title: "Insufficient Margin",
        description: "You don't have enough available margin for this trade",
        variant: "destructive",
      });
      return;
    }

    setIsExecuting(true);

    try {
      const success = await openTrade(
        selectedAsset.id,
        selectedAsset.symbol,
        tradeType,
        tradeAmount,
        leverage,
        selectedAsset.price,
        calculateMargin
      );

      if (success) {
        toast({
          title: "Trade Executed",
          description: `${tradeType} order for ${selectedAsset.symbol} executed successfully`,
        });
        
        // Database triggers will automatically handle margin recalculation
        console.log('Trade executed successfully, margins will be auto-calculated by database triggers');
      }
    } catch (error) {
      console.error('Trade execution error:', error);
      toast({
        title: "Trade Failed",
        description: "Failed to execute trade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleEnhancedTrade = async (orderData: {
    orderType: 'market' | 'limit' | 'stop';
    tradeType: 'BUY' | 'SELL';
    triggerPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    expiresAt?: Date;
  }) => {
    if (!selectedAsset || !profile) return;

    const tradeAmount = selectedAsset.category === 'forex' ? 1 : amount;
    
    if (tradeAmount < selectedAsset.min_trade_size) {
      toast({
        title: "Invalid Trade Size",
        description: `Minimum trade size is ${selectedAsset.min_trade_size}`,
        variant: "destructive",
      });
      return;
    }

    setIsExecuting(true);

    try {
      if (orderData.orderType === 'market') {
        // Execute market order immediately with stop loss and take profit
        const success = await openTrade(
          selectedAsset.id,
          selectedAsset.symbol,
          orderData.tradeType,
          tradeAmount,
          leverage,
          selectedAsset.price,
          calculateMargin
        );

        if (success) {
          toast({
            title: "Market Order Executed",
            description: `${orderData.tradeType} order for ${selectedAsset.symbol} executed successfully`,
          });
          // Database triggers will automatically handle margin recalculation
          console.log('Market order executed successfully, margins will be auto-calculated by database triggers');
        }
      } else {
        // Create pending order
        const order = await createOrder({
          asset_id: selectedAsset.id,
          symbol: selectedAsset.symbol,
          order_type: orderData.orderType,
          trade_type: orderData.tradeType,
          amount: tradeAmount,
          leverage,
          trigger_price: orderData.triggerPrice,
          stop_loss_price: orderData.stopLoss,
          take_profit_price: orderData.takeProfit,
          expires_at: orderData.expiresAt?.toISOString(),
        });

        if (order) {
          toast({
            title: "Order Created",
            description: `${orderData.orderType} ${orderData.tradeType} order for ${selectedAsset.symbol} created successfully`,
          });
        }
      }
    } catch (error) {
      console.error('Order execution error:', error);
      toast({
        title: "Order Failed",
        description: "Failed to create order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCloseTrade = async (tradeId: string, closePrice: number) => {
    setIsExecuting(true);
    try {
      await closeTrade(tradeId, closePrice);
      // Database triggers will automatically handle margin recalculation
      console.log('Trade closed successfully, margins will be auto-calculated by database triggers');
    } catch (error) {
      console.error('Error closing trade:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const toggleFavorite = async (asset) => {
    const isFavorited = favorites.some(f => f.asset_id === asset.id);
    if (isFavorited) {
      await removeFavorite(asset.id);
    } else {
      await addFavorite(asset.id);
    }
  };

  const AssetRow = React.memo(({ asset }: { asset: any }) => {
    const isFavorited = favorites.some(f => f.asset_id === asset.id);
    
    return (
      <div 
        className={`p-3 rounded-lg border cursor-pointer transition-all duration-300 hover:scale-[1.02] group ${
          selectedAsset?.id === asset.id 
            ? 'bg-gradient-to-r from-primary/20 to-primary/10 border-primary/40 shadow-lg shadow-primary/20' 
            : 'bg-muted/20 border-muted/30 hover:bg-muted/40 hover:border-muted/50 hover:shadow-md'
        }`}
        onClick={() => setSelectedAsset(asset)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm group-hover:text-foreground transition-colors">{asset.symbol}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:scale-110 transition-transform duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(asset);
                }}
              >
                {isFavorited ? (
                  <StarIcon className="h-3 w-3 fill-current text-yellow-500 animate-bounce-gentle" />
                ) : (
                  <Star className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                )}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground/70 truncate group-hover:text-muted-foreground transition-colors">{asset.name}</div>
          </div>
          <div className="text-right">
            <PulsingPriceIndicator 
              price={asset.price} 
              change={asset.change_24h}
              symbol={asset.symbol} 
            />
          </div>
        </div>
      </div>
    );
  });

  if (assetsLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary mx-auto"></div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/20 to-transparent animate-pulse"></div>
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-foreground">Loading Trading Platform</p>
            <p className="text-sm text-muted-foreground animate-pulse">Preparing your market data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Please log in to access the trading platform.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-background p-0 md:p-6 relative">
      <div className="mx-auto max-w-none md:max-w-7xl">
        <div className="mb-6">
          <div className="flex flex-col gap-3 mb-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/dashboard')}
              className="md:hidden self-start flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-300 hover:scale-105 group"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <div className="text-center animate-fade-in-up">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">Web Trading Platform</h1>
              <p className="text-muted-foreground/80 text-sm md:text-base mt-1">Advanced trading with real-time market data</p>
            </div>
          </div>
        </div>

        {selectedAsset && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Market Watch - Fixed Height */}
            <div className="lg:col-span-1">
              <Card className="bg-card/90 backdrop-blur-lg border-border/60 shadow-lg hover:shadow-xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1">
                <CardHeader className="pb-2 px-4 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Market Watch</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground/80">Live market data</CardDescription>
                    </div>
                    <div className="animate-pulse">
                      <PriceConnectionStatus />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4">
                  <div className="space-y-2">
                    <Input
                      placeholder="Search assets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-muted/20 h-9"
                    />
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="bg-muted/20 h-9">
                        <SelectValue placeholder="Filter by category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="forex">Forex</SelectItem>
                        <SelectItem value="crypto">Cryptocurrency</SelectItem>
                        <SelectItem value="stocks">Stocks</SelectItem>
                        <SelectItem value="commodities">Commodities</SelectItem>
                        <SelectItem value="indices">Indices</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Tabs defaultValue="all" className="">
                    <TabsList className="grid w-full grid-cols-2 h-9">
                      <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                      <TabsTrigger value="favorites" className="text-xs">Favorites</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="all" className="mt-2">
                        <div className="max-h-[400px] md:max-h-[600px] overflow-y-auto space-y-2 pr-2">
                         {(isMobile ? filteredAssets.slice(0, 4) : filteredAssets.slice(0, 8)).map((asset) => (
                           <AssetRow key={asset.id} asset={asset} />
                         ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="favorites" className="mt-2">
                      <div className="max-h-[400px] md:max-h-[600px] overflow-y-auto space-y-2 pr-2">
                        {favoriteAssets.length > 0 ? (
                           (isMobile ? favoriteAssets.slice(0, 4) : favoriteAssets.slice(0, 8)).map((asset) => (
                             <AssetRow key={asset.id} asset={asset} />
                           ))
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No favorite assets</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Floating Action Button */}
            <FloatingActionButton
              onTrade={() => navigate('/webtrader')}
            />

            {/* Right Column - Chart and Trading - Fixed Heights */}
            <div className="lg:col-span-2 space-y-4">
              {/* Chart Section - 400px Fixed Height */}
              <div className="h-[400px] animate-fade-in">
                <div className="rounded-lg border bg-card/90 backdrop-blur-lg shadow-lg hover:shadow-xl transition-all duration-500 h-full overflow-hidden">
                  <TradingChart 
                    key={selectedAsset?.id || 'no-asset'} 
                    symbol={selectedAsset?.symbol || ''} 
                  />
                </div>
              </div>

              {/* Trading Tabs Interface - 200px Fixed Height */}
              <TradingTabsInterface
                selectedAsset={selectedAsset}
                amount={amount}
                leverage={leverage}
                onAmountChange={setAmount}
                onLeverageChange={setLeverage}
                onTrade={handleEnhancedTrade}
                userProfile={profile}
                isExecuting={isExecuting}
                openTrades={openTrades}
                realtimeAssets={realtimeAssets}
                onCloseTrade={(tradeId) => {
                  const asset = realtimeAssets.find(a => openTrades.find(t => t.id === tradeId)?.asset_id === a.id);
                  handleCloseTrade(tradeId, asset?.price || 0);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};