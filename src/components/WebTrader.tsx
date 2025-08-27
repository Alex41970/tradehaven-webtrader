import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TradingChart } from "./TradingChart";
import { toast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, Star, StarOff, Search, X } from "lucide-react";
import { useAssets, Asset } from "@/hooks/useAssets";
import { useTrades } from "@/hooks/useTrades";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useFavorites } from "@/hooks/useFavorites";
import { PulsingPriceIndicator } from "@/components/PulsingPriceIndicator";

export const WebTrader = () => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState<string>('1');
  const [leverage, setLeverage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const { assets, loading: assetsLoading } = useAssets();
  const { openTrades, closeTrade, openTrade } = useTrades();
  const { profile } = useUserProfile();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();

  // Filter assets based on search and category
  const filteredAssets = useMemo(() => {
    let filtered = assets;
    
    if (searchTerm) {
      filtered = filtered.filter(asset => 
        asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(asset => asset.category === selectedCategory);
    }
    
    return filtered;
  }, [assets, searchTerm, selectedCategory]);

  // Get favorite assets
  const favoriteAssets = useMemo(() => {
    return assets.filter(asset => isFavorite(asset.id));
  }, [assets, favorites]);

  // Set default selected asset
  useEffect(() => {
    if (assets.length > 0 && !selectedAsset) {
      const btc = assets.find(asset => asset.symbol === 'BTCUSD');
      setSelectedAsset(btc || assets[0]);
    }
  }, [assets, selectedAsset]);

  // Update selectedAsset when underlying asset data changes (real-time price updates)
  useEffect(() => {
    if (selectedAsset && assets.length > 0) {
      const updatedAsset = assets.find(asset => asset.id === selectedAsset.id);
      if (updatedAsset && (
        updatedAsset.price !== selectedAsset.price || 
        updatedAsset.change_24h !== selectedAsset.change_24h
      )) {
        setSelectedAsset(updatedAsset);
      }
    }
  }, [assets, selectedAsset]);

  // Calculate trade details with memoization for performance
  const calculateMargin = useMemo(() => {
    if (!selectedAsset) return 0;
    
    if (selectedAsset.category === 'forex') {
      // For forex: always use 1 standard lot (100,000 units)
      const notionalValue = 1 * selectedAsset.contract_size * selectedAsset.price;
      return notionalValue / leverage;
    } else {
      // For stocks, crypto, commodities, indices: trade in actual units
      if (!amount) return 0;
      const tradeAmount = parseFloat(amount);
      return (tradeAmount * selectedAsset.price) / leverage;
    }
  }, [selectedAsset, leverage, amount]);

  const calculatePositionSize = useMemo(() => {
    if (!selectedAsset) return 0;
    
    if (selectedAsset.category === 'forex') {
      // For forex: always show notional value of 1 standard lot
      return 1 * selectedAsset.contract_size * selectedAsset.price;
    } else {
      // For other instruments: show the total value (amount * price)
      if (!amount) return 0;
      const tradeAmount = parseFloat(amount);
      return tradeAmount * selectedAsset.price;
    }
  }, [selectedAsset, amount]);

  const handleTrade = async () => {
    if (!selectedAsset || !profile) {
      toast({
        title: "Error",
        description: "Please select an asset and ensure your profile is loaded",
        variant: "destructive",
      });
      return;
    }

    let tradeAmount: number;
    
    if (selectedAsset.category === 'forex') {
      // For forex: always use 1 standard lot
      tradeAmount = 1;
    } else {
      // For other instruments: validate user input
      tradeAmount = parseFloat(amount);
      if (isNaN(tradeAmount) || tradeAmount <= 0) {
        toast({
          title: "Invalid Amount",
          description: "Please enter a valid trade amount",
          variant: "destructive",
        });
        return;
      }

      if (tradeAmount < selectedAsset.min_trade_size) {
        toast({
          title: "Minimum Trade Size",
          description: `Minimum trade size for ${selectedAsset.symbol} is ${selectedAsset.min_trade_size}`,
          variant: "destructive",
        });
        return;
      }
    }

    const marginRequired = calculateMargin;
    if (marginRequired > profile.available_margin) {
      toast({
        title: "Insufficient Margin",
        description: `Required margin: $${marginRequired.toFixed(2)}, Available: $${profile.available_margin.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    // Open the trade
    const trade = await openTrade(
      selectedAsset.id,
      selectedAsset.symbol,
      tradeType,
      tradeAmount,
      leverage,
      selectedAsset.price,
      marginRequired
    );

    if (trade) {
      toast({
        title: "Trade Successful",
        description: `${tradeType} ${selectedAsset.category === 'forex' ? '1 lot' : tradeAmount} ${selectedAsset.symbol} opened successfully!`,
      });
    }
  };

  const handleCloseTrade = async (tradeId: string) => {
    const trade = openTrades.find(t => t.id === tradeId);
    if (!trade) return;

    const asset = assets.find(a => a.id === trade.asset_id);
    if (!asset) return;

    await closeTrade(tradeId, asset.price);
  };

  const toggleFavorite = async (asset: Asset) => {
    if (isFavorite(asset.id)) {
      await removeFavorite(asset.id);
    } else {
      await addFavorite(asset.id);
    }
  };

  const AssetRow = ({ asset, showFavorite = true }: { asset: Asset; showFavorite?: boolean }) => (
    <div
      key={asset.id}
      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
        selectedAsset?.id === asset.id 
          ? 'bg-primary/10 border-l-4 border-l-primary' 
          : 'hover:bg-muted/50'
      }`}
      onClick={() => setSelectedAsset(asset)}
    >
      <div className="flex items-center gap-3">
        {showFavorite && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(asset);
            }}
          >
            {isFavorite(asset.id) ? (
              <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
            ) : (
              <StarOff className="h-4 w-4" />
            )}
          </Button>
        )}
        <div>
          <div className="font-medium text-sm">{asset.symbol}</div>
          <div className="text-xs text-muted-foreground">
            {asset.name}
          </div>
        </div>
      </div>
      <PulsingPriceIndicator 
        price={asset.price} 
        change={asset.change_24h} 
        symbol={asset.symbol}
      />
    </div>
  );

  if (assetsLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Market Watch */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Market Watch</CardTitle>
          <CardDescription>Select an asset to trade</CardDescription>
          
          {/* Search and Filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="forex">Forex</SelectItem>
                <SelectItem value="crypto">Crypto</SelectItem>
                <SelectItem value="stocks">Stocks</SelectItem>
                <SelectItem value="commodities">Commodities</SelectItem>
                <SelectItem value="indices">Indices</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
              <TabsTrigger value="trades">Open Trades</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-0">
              <div className="max-h-96 overflow-y-auto p-3 space-y-2">
                {filteredAssets.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No assets found
                  </div>
                ) : (
                  filteredAssets.map((asset) => (
                    <AssetRow key={asset.id} asset={asset} />
                  ))
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="favorites" className="mt-0">
              <div className="max-h-96 overflow-y-auto p-3 space-y-2">
                {favoriteAssets.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No favorites yet
                  </div>
                ) : (
                  favoriteAssets.map((asset) => (
                    <AssetRow key={asset.id} asset={asset} showFavorite={false} />
                  ))
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="trades" className="mt-0">
              <div className="max-h-96 overflow-y-auto p-3 space-y-2">
                {openTrades.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No open trades
                  </div>
                ) : (
                  openTrades.map((trade) => {
                    const asset = assets.find(a => a.id === trade.asset_id);
                    if (!asset) return null;
                    
                    return (
                      <div
                        key={trade.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div>
                          <div className="font-medium text-sm">{trade.symbol}</div>
                          <div className="text-xs text-muted-foreground">
                            {trade.trade_type} {asset?.category === 'forex' ? '1 lot' : trade.amount} @ {trade.open_price}
                          </div>
                          <div className={`text-xs ${
                            trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            P&L: ${trade.pnl.toFixed(2)}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCloseTrade(trade.id)}
                        >
                          Close
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Chart and Trading Panel */}
      <div className="lg:col-span-2 space-y-6">
        {/* Chart */}
        {selectedAsset && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedAsset.name}
                  <Badge variant="secondary" className="ml-2">
                    {selectedAsset.category.toUpperCase()}
                  </Badge>
                </div>
                <PulsingPriceIndicator 
                  price={selectedAsset.price} 
                  change={selectedAsset.change_24h} 
                  symbol={selectedAsset.symbol}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TradingChart symbol={selectedAsset.symbol} />
            </CardContent>
          </Card>
        )}

        {/* Trading Panel */}
        {selectedAsset && profile && (
          <Card>
            <CardHeader>
              <CardTitle>Place Trade</CardTitle>
              <CardDescription>
                Balance: ${profile.balance.toFixed(2)} | Available Margin: ${profile.available_margin.toFixed(2)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tradeType">Trade Type</Label>
                  <Select value={tradeType} onValueChange={(value: 'BUY' | 'SELL') => setTradeType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">BUY</SelectItem>
                      <SelectItem value="SELL">SELL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="amount">
                    {selectedAsset.category === 'forex' ? 'Trade Size' : 'Amount'}
                  </Label>
                  {selectedAsset.category === 'forex' ? (
                    <div className="flex items-center h-10 px-3 py-2 border border-input bg-muted/20 rounded-md">
                      <span className="text-sm">1 Standard Lot</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({selectedAsset.contract_size.toLocaleString()} units)
                      </span>
                    </div>
                  ) : (
                    <Input
                      id="amount"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                      step={selectedAsset.min_trade_size}
                      min={selectedAsset.min_trade_size}
                    />
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="leverage">Leverage: {leverage}x</Label>
                <Select value={leverage.toString()} onValueChange={(value) => setLeverage(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 5, 10, 20, 50, Math.min(100, selectedAsset.max_leverage)].map((lev) => (
                      <SelectItem key={lev} value={lev.toString()}>
                        {lev}x
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/20 rounded-lg border-l-4 border-l-primary/30">
                <div>
                  <div className="text-sm text-muted-foreground">Position Size</div>
                  <div className="font-medium animate-pulse-subtle">${calculatePositionSize.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Margin Required</div>
                  <div className="font-medium animate-pulse-subtle">${calculateMargin.toFixed(2)}</div>
                </div>
              </div>

              <Button
                onClick={handleTrade}
                className="w-full"
                size="lg"
                variant={tradeType === 'BUY' ? 'trading' : 'destructive'}
                disabled={
                  selectedAsset.category === 'forex' 
                    ? calculateMargin > profile.available_margin
                    : calculateMargin > profile.available_margin ||
                      (parseFloat(amount) || 0) < selectedAsset.min_trade_size ||
                      !amount
                }
              >
                {tradeType} {selectedAsset.symbol}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};