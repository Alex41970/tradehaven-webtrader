import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TradingChart } from "./TradingChart";
import { QuickTradePanel } from "./QuickTradePanel";
import { TradingTabsInterface } from "./TradingTabsInterface";
import { Star, StarIcon, ArrowLeft, ListPlus, Minus, Plus, SlidersHorizontal, Search } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useAssets } from "@/hooks/useAssets";
import { useTrades } from "@/hooks/useTrades";
import { useSharedUserProfile } from "@/hooks/useSharedUserProfile";
import { useWatchlists } from "@/hooks/useWatchlists";
import { usePrices } from "@/contexts/PriceContext";
import { SentimentBar } from "./intel/SentimentBar";
import { PriceAlertButton } from "./intel/PriceAlertButton";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { useTradeOrders } from "@/hooks/useTradeOrders";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";
import { WebTraderSkeleton } from "./WebTraderSkeleton";
import { MarketClosedBanner, useMarketSession } from "./market/MarketClosedBanner";
import { isMarketOpen } from "@/utils/marketHours";
import { useRealtimeAccountMetrics } from "@/hooks/useRealtimeAccountMetrics";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import { ResizeHandle } from "@/components/ResizeHandle";

export const WebTrader = ({ initialSymbol }: { initialSymbol?: string } = {}) => {
  const { openTrade, closeTrade, openTrades } = useTrades();
  const { assets, loading: assetsLoading } = useAssets();
  const { profile, loading: profileLoading } = useSharedUserProfile();
  const { lists, createList, renameList, deleteList, toggleItem, inAnyList } = useWatchlists();
  const { serverPrices } = usePrices();
  const { getUpdatedAssets, isConnected, lastUpdate } = useRealTimePrices();
  const { createOrder } = useTradeOrders();
  const { canOpenTrade } = useRealtimeAccountMetrics();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [amount, setAmount] = useState(1);
  const [leverage, setLeverage] = useState(100);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isExecuting, setIsExecuting] = useState(false);
  const [listTab, setListTab] = useState("all");
  const pickedInitial = useRef(false);
  const [mobileView, setMobileView] = useState<"quotes" | "chart">(initialSymbol ? "chart" : "quotes");
  const [orderSheet, setOrderSheet] = useState(false);
  const tapStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const selectAsset = useCallback((asset: any) => { setSelectedAsset(asset); setMobileView("chart"); }, []);
  // Phone Buy/Sell needs a second tap to confirm, unless the trader turned on one-tap trading.
  const [armedSide, setArmedSide] = useState<"BUY" | "SELL" | null>(null);
  const [oneTap, setOneTap] = useState(() => typeof window !== "undefined" && localStorage.getItem("mobileOneTap") === "1");
  useEffect(() => { if (!armedSide) return; const t = setTimeout(() => setArmedSide(null), 3000); return () => clearTimeout(t); }, [armedSide]);
  const mobileTrade = (side: "BUY" | "SELL") => {
    if (oneTap || armedSide === side) { setArmedSide(null); handleTrade(side); } else setArmedSide(side);
  };

  // Panel widths the trader can drag and have remembered.
  const marketsPanel = useResizableWidth("markets", 220, 180, 420);
  const ticketPanel = useResizableWidth("ticket", 300, 250, 480);

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

  const activeList = lists.find((l) => l.id === listTab);
  useEffect(() => {
    if (listTab !== "all" && !activeList && lists.length) setListTab("all");
  }, [lists, listTab, activeList]);
  const visibleAssets = useMemo(() => {
    if (!activeList) return filteredAssets;
    return filteredAssets.filter((a) => activeList.assetIds.includes(a.id));
  }, [filteredAssets, activeList]);

  // Auto-select the requested (or first) asset if none selected
  useEffect(() => {
    if (realtimeAssets.length === 0) return;
    if (initialSymbol && selectedAsset?.symbol !== initialSymbol && !pickedInitial.current) {
      const a = realtimeAssets.find((x) => x.symbol === initialSymbol);
      if (a) { pickedInitial.current = true; setSelectedAsset(a); return; }
    }
    if (!selectedAsset) setSelectedAsset(realtimeAssets[0]);
  }, [realtimeAssets, selectedAsset, initialSymbol]);

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

  // Always set leverage to 100x when asset changes
  useEffect(() => {
    if (selectedAsset) {
      setLeverage(100);
    }
  }, [selectedAsset?.id]);

  // Real-time updates are now handled by WebSocket system, no need for Supabase subscriptions

  // Calculate margin required
  const calculateMargin = useMemo(() => {
    if (!selectedAsset) return 0;
    
    // Lots x contract size x price / leverage
    return (amount * (selectedAsset.contract_size || 1) * selectedAsset.price) / leverage;
  }, [selectedAsset, amount, leverage]);

  const { open: selectedOpen, label: opensLabel } = useMarketSession(selectedAsset?.symbol, selectedAsset?.category);

  // Calculate position size
  const calculatePositionSize = useMemo(() => {
    if (!selectedAsset) return 0;
    
    // Notional value of the position: lots x contract size x price
    return amount * (selectedAsset.contract_size || 1) * selectedAsset.price;
  }, [selectedAsset, amount]);

  const handleTrade = async (tradeType: 'BUY' | 'SELL') => {
    if (!selectedAsset || !profile) return;
    if (!selectedOpen) {
      toast({ title: "Market closed", description: `${selectedAsset.symbol} ${opensLabel}. You can place a pending order instead.` });
      return;
    }
    
    const tradeAmount = amount;
    
    if (tradeAmount < selectedAsset.min_trade_size) {
      toast({
        title: "Invalid Trade Size",
        description: `Minimum trade size is ${selectedAsset.min_trade_size}`,
        variant: "destructive",
      });
      return;
    }

    // Real-time margin validation
    if (!canOpenTrade(calculateMargin)) {
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
      }
    } catch (error) {
      toast({
        title: "Trade Failed",
        description: error instanceof Error && error.message ? error.message : "Failed to execute trade. Please try again.",
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

    const tradeAmount = amount;
    
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
      if (orderData.orderType === 'market' && !selectedOpen) {
        toast({ title: "Market closed", description: `${selectedAsset.symbol} ${opensLabel}. You can place a pending order instead.` });
      } else if (orderData.orderType === 'market') {
        // Execute market order immediately with stop loss and take profit
        const success = await openTrade(
          selectedAsset.id,
          selectedAsset.symbol,
          orderData.tradeType,
          tradeAmount,
          leverage,
          selectedAsset.price,
          calculateMargin,
          orderData.stopLoss,
          orderData.takeProfit
        );

        if (success) {
          toast({
            title: "Market Order Executed",
            description: `${orderData.tradeType} order for ${selectedAsset.symbol} executed successfully`,
          });
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
      toast({
        title: "Order Failed",
        description: error instanceof Error && error.message ? error.message : "Failed to create order. Please try again.",
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
    } catch (error) {
      toast({
        title: "Could not close the trade",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Asset row component for market watch
  // Rendered as a plain function (not a component) so rows aren't remounted on every price tick.
  const renderAssetRow = (asset: any) => {
    const isFavorited = inAnyList(asset.id);
    const closed = !isMarketOpen(asset.symbol, asset.category);
    return (
      <div key={asset.id}
        className={`px-2.5 py-2 max-md:py-3 rounded-lg border cursor-pointer transition-colors touch-manipulation select-none ${
          selectedAsset?.id === asset.id 
            ? 'bg-primary/10 border-primary/40' 
            : 'border-transparent hover:bg-muted/60'
        } ${closed ? 'opacity-50' : ''}`}
        onPointerDown={(e) => { tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now() }; }}
        onPointerCancel={() => { tapStart.current = null; }}
        onClick={(e) => {
          // Only a real tap opens the market: a scroll/swipe that began on the row never does.
          const st = tapStart.current; tapStart.current = null;
          if (st && (Math.abs(e.clientX - st.x) > 8 || Math.abs(e.clientY - st.y) > 8 || Date.now() - st.t > 600)) return;
          selectAsset(asset);
        }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectAsset(asset); } }}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center justify-between asset-row-main pointer-events-none">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-medium text-sm truncate">{asset.symbol}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 max-md:h-9 max-md:w-9 -my-1.5 pointer-events-auto" aria-label="Add to watchlist"
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                    {isFavorited ? <StarIcon className="h-3 w-3 fill-current text-primary" /> : <Star className="h-3 w-3" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuLabel className="text-xs">Add {asset.symbol} to</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {lists.map((l) => (
                    <DropdownMenuCheckboxItem key={l.id} checked={l.assetIds.includes(asset.id)} onSelect={(e) => e.preventDefault()}
                      onCheckedChange={() => toggleItem(l.id, asset.id)}>{l.name}</DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuItem onClick={async () => { const n = window.prompt("New watchlist name"); if (n) { const id = await createList(n); if (id) toggleItem(id, asset.id); } }}>
                    + New watchlist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="text-xs text-muted-foreground truncate">{closed && <span className="mr-1 rounded bg-muted px-1 text-[9px] font-medium uppercase tracking-wide">Closed</span>}{asset.name}</div>
          </div>
          <div className="shrink-0 pl-2 flex flex-col items-end gap-0.5">
            <span className="font-mono text-sm font-medium tabular-nums">
              {(Number(asset.price) || 0).toFixed(asset.symbol.includes('JPY') ? 3 : Number(asset.price) >= 100 ? 2 : Number(asset.price) >= 1 ? 4 : 5)}
            </span>
            <span className={`font-mono text-[11px] tabular-nums px-1.5 rounded ${
              (asset.change_24h || 0) >= 0 ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'
            }`}>
              {(asset.change_24h || 0) >= 0 ? '+' : ''}{(Number(asset.change_24h) || 0).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (assetsLoading || profileLoading) {
    return <WebTraderSkeleton />;
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

  if (isMobile && selectedAsset) {
    const price = Number(selectedAsset.price) || 0;
    const minLots = selectedAsset.min_trade_size || 0.01;
    const step = amount >= 1 ? 0.1 : 0.01;
    const setLots = (v: number) => setAmount(Math.max(minLots, Math.round(v * 100) / 100));
    const fmtP = (n: number) => (n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(4) : n.toFixed(5));
    const chg = Number(selectedAsset.change_24h) || 0;

    if (mobileView === "quotes") {
      return (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search markets" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-11 bg-muted/20 pl-9 text-base" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 overscroll-x-contain">
            {[["all", "All"], ["crypto", "Crypto"], ["forex", "Forex"], ["stocks", "Stocks"], ["indices", "Indices"], ["commodities", "Commodities"]].map(([v, l]) => (
              <button key={v} onClick={() => setCategoryFilter(v)}
                className={`h-10 shrink-0 rounded-full border px-4 text-xs touch-manipulation ${categoryFilter === v ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>{l}</button>
            ))}
          </div>
          {lists.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain">
              {[{ id: "all", name: "All markets" }, ...lists].map((l) => (
                <button key={l.id} onClick={() => setListTab(l.id)}
                  className={`h-10 shrink-0 rounded-md px-3 text-xs touch-manipulation ${listTab === l.id ? "bg-muted text-foreground" : "text-muted-foreground"}`}>{l.name}</button>
              ))}
            </div>
          )}
          <div className="space-y-1">
            {visibleAssets.length > 0 ? visibleAssets.map((asset) => renderAssetRow(asset))
              : <p className="py-10 text-center text-sm text-muted-foreground">{activeList ? "Use the star on any market to add it here" : "No markets found"}</p>}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => setMobileView("quotes")} aria-label="Back to markets">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{selectedAsset.symbol}</div>
            <div className="truncate text-xs text-muted-foreground">{selectedAsset.name}</div>
          </div>
          <div className="text-right">
            <div className="num text-sm font-semibold">{fmtP(price)}</div>
            <div className={`num text-xs ${chg >= 0 ? "text-success" : "text-destructive"}`}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</div>
          </div>
        </div>
        <div className="h-[calc(100dvh-340px)] min-h-[280px] touch-none overscroll-contain">
          <TradingChart key={selectedAsset.id} symbol={selectedAsset.symbol} category={selectedAsset.category} name={selectedAsset.name}
            toolbarExtra={<PriceAlertButton symbol={selectedAsset.symbol} price={serverPrices.get(selectedAsset.symbol) ?? price} />} />
        </div>
        <MarketClosedBanner symbol={selectedAsset.symbol} category={selectedAsset.category} />
        <SentimentBar symbol={selectedAsset.symbol} change24h={chg} category={selectedAsset.category} />

        {/* One-tap trade bar, pinned above the phone tab bar */}
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 px-2 pb-2 pt-2 backdrop-blur-xl">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Margin <span className="num text-foreground">${calculateMargin.toFixed(2)}</span> · 1:{leverage}</span>
            <label className="flex h-7 items-center gap-1.5">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={oneTap}
                onChange={(e) => { setOneTap(e.target.checked); localStorage.setItem("mobileOneTap", e.target.checked ? "1" : "0"); }} />
              One-tap
            </label>
            <button className="flex h-7 items-center gap-1 text-primary" onClick={() => setOrderSheet(true)}>
              <SlidersHorizontal className="h-3.5 w-3.5" />New order
            </button>
          </div>
          {!selectedOpen ? (
            <button onClick={() => setOrderSheet(true)}
              className="flex h-14 w-full flex-col items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Market closed</span>
              <span className="text-[11px] text-primary">Place a pending order</span>
            </button>
          ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
            <button disabled={isExecuting} onClick={() => mobileTrade("SELL")}
              className={`flex h-14 flex-col items-center justify-center rounded-lg bg-destructive text-destructive-foreground disabled:opacity-50 touch-manipulation ${armedSide === "SELL" ? "ring-2 ring-offset-2 ring-offset-background ring-destructive" : ""}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wider">{armedSide === "SELL" ? `Tap to confirm Sell` : "Sell"}</span>
              <span className="num text-base font-bold">{fmtP(price)}</span>
            </button>
            <div className="flex w-[124px] items-center rounded-lg border border-border">
              <button className="flex h-full w-10 items-center justify-center touch-manipulation" onClick={() => setLots(amount - step)} aria-label="Less lots"><Minus className="h-4 w-4" /></button>
              <input type="text" inputMode="decimal" value={amount}
                onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) setAmount(v); }}
                onBlur={() => setLots(amount)} aria-label="Lots"
                className="num h-full w-full min-w-0 bg-transparent text-center text-base outline-none" />
              <button className="flex h-full w-10 items-center justify-center touch-manipulation" onClick={() => setLots(amount + step)} aria-label="More lots"><Plus className="h-4 w-4" /></button>
            </div>
            <button disabled={isExecuting} onClick={() => mobileTrade("BUY")}
              className={`flex h-14 flex-col items-center justify-center rounded-lg bg-success text-success-foreground disabled:opacity-50 touch-manipulation ${armedSide === "BUY" ? "ring-2 ring-offset-2 ring-offset-background ring-success" : ""}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wider">{armedSide === "BUY" ? `Tap to confirm Buy` : "Buy"}</span>
              <span className="num text-base font-bold">{fmtP(price)}</span>
            </button>
          </div>
          )}
        </div>
        <div className="h-[104px]" />

        <Drawer open={orderSheet} onOpenChange={setOrderSheet}>
          <DrawerContent className="max-h-[92dvh]">
            <DrawerHeader className="text-left"><DrawerTitle>New order · {selectedAsset.symbol}</DrawerTitle></DrawerHeader>
            <div className="overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <TradingTabsInterface
                selectedAsset={selectedAsset} amount={amount} leverage={leverage}
                onAmountChange={setAmount} onLeverageChange={setLeverage}
                onTrade={async (o) => { await handleEnhancedTrade(o); setOrderSheet(false); }}
                userProfile={profile} isExecuting={isExecuting} openTrades={openTrades} realtimeAssets={realtimeAssets}
                onCloseTrade={(tradeId) => {
                  const asset = realtimeAssets.find(a => openTrades.find(t => t.id === tradeId)?.asset_id === a.id);
                  handleCloseTrade(tradeId, asset?.price || 0);
                }}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className="w-full">
      {(marketsPanel.dragging || ticketPanel.dragging) && <div className="fixed inset-0 z-[70] cursor-col-resize" />}
      <div className="mx-auto max-w-[1800px]">
        <div className="mb-3 flex items-center gap-2 md:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-muted-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
        </div>
        {selectedAsset && (
        <div
          className="grid grid-cols-1 gap-4 lg:grid-cols-[var(--mk)_minmax(0,1fr)] xl:grid-cols-[var(--mk)_minmax(0,1fr)_var(--tk)]"
          style={{ "--mk": `${marketsPanel.width}px`, "--tk": `${ticketPanel.width}px` } as React.CSSProperties}
        >
            {/* Left Column - Market Watch - Fixed Height */}
            <div className="relative order-2 lg:order-1 lg:row-span-2">
              <ResizeHandle side="right" label="Resize markets list" dragging={marketsPanel.dragging}
                onPointerDown={(e) => marketsPanel.startDrag(e, 1)} />
              <Card className="bento lg:sticky lg:top-20">
                <CardHeader className="pb-2 px-3 pt-3">
                  <div>
                    <CardTitle className="text-sm font-semibold">Markets</CardTitle>
                    <CardDescription className="text-xs">{filteredAssets.length} instruments</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 px-3 pb-3">
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

                  <Tabs value={listTab} onValueChange={setListTab} className="">
                    <div className="flex items-center gap-1">
                      <div className="min-w-0 flex-1 overflow-x-auto">
                        <TabsList className="h-9 w-max">
                          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                          {lists.map((l) => <TabsTrigger key={l.id} value={l.id} className="max-w-[120px] truncate text-xs">{l.name}</TabsTrigger>)}
                        </TabsList>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Watchlist options"><ListPlus className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={async () => { const n = window.prompt("New watchlist name"); if (n) { const id = await createList(n); if (id) setListTab(id); } }}>New watchlist</DropdownMenuItem>
                          {activeList && <>
                            <DropdownMenuItem onClick={() => { const n = window.prompt("Rename watchlist", activeList.name); if (n) renameList(activeList.id, n); }}>Rename "{activeList.name}"</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm(`Delete "${activeList.name}"?`)) { deleteList(activeList.id); setListTab("all"); } }}>Delete "{activeList.name}"</DropdownMenuItem>
                          </>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-2">
                      <ScrollArea className="h-[420px] lg:h-[calc(100vh-280px)] [&_[data-radix-scroll-area-viewport]>div]:!block">
                        <div className="space-y-1 pr-3">
                          {visibleAssets.length > 0 ? (
                            visibleAssets.map((asset) => renderAssetRow(asset))
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">{activeList ? "Use the star on any market to add it here" : "No markets found"}</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Chart and Trading - Fixed Heights */}
            <div className="order-1 flex h-[460px] flex-col gap-3 md:h-[640px] lg:order-2">
              <MarketClosedBanner symbol={selectedAsset?.symbol} category={selectedAsset?.category} />
              <div className="min-h-0 flex-1">
                <TradingChart 
                  key={selectedAsset?.id || 'no-asset'} 
                  symbol={selectedAsset?.symbol || ''} 
                  category={selectedAsset?.category}
                  name={selectedAsset?.name}
                  toolbarExtra={selectedAsset && (
                    <PriceAlertButton symbol={selectedAsset.symbol} price={serverPrices.get(selectedAsset.symbol) ?? selectedAsset.price} />
                  )}
                  fullscreenOverlay={selectedAsset && (
                    <QuickTradePanel
                      price={Number(selectedAsset.price) || 0}
                      lots={amount}
                      leverage={leverage}
                      minLots={selectedAsset.min_trade_size || 0.01}
                      margin={calculateMargin}
                      busy={isExecuting}
                      onLotsChange={setAmount}
                      onLeverageChange={setLeverage}
                      onTrade={handleTrade}
                    />
                  )}
                />
              </div>
              <SentimentBar symbol={selectedAsset.symbol} change24h={Number(selectedAsset.change_24h) || 0} category={selectedAsset.category} />
            </div>

            <div className="relative order-3 lg:col-start-2 xl:col-start-3 xl:row-start-1 xl:row-span-2 xl:h-[640px]">
              <ResizeHandle side="left" label="Resize trade panel" dragging={ticketPanel.dragging}
                showClassName="hidden xl:flex" onPointerDown={(e) => ticketPanel.startDrag(e, -1)} />
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