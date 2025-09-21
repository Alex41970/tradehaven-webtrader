import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TradeRow } from "./TradeRow";
import { EnhancedTradingPanel } from "./EnhancedTradingPanel";
import { OrderManagement } from "./OrderManagement";
import { TrendingUp, Clock } from "lucide-react";
import { useRealtimePnL } from "@/hooks/useRealtimePnL";
import { PulsingPnLIndicator } from "./PulsingPnLIndicator";

interface TradingTabsInterfaceProps {
  selectedAsset: any;
  amount: number;
  leverage: number;
  onAmountChange: (amount: number) => void;
  onLeverageChange: (leverage: number) => void;
  onTrade: (orderData: any) => void;
  userProfile: any;
  isExecuting: boolean;
  openTrades: any[];
  realtimeAssets: any[];
  onCloseTrade: (tradeId: string) => void;
}

export const TradingTabsInterface: React.FC<TradingTabsInterfaceProps> = ({
  selectedAsset,
  amount,
  leverage,
  onAmountChange,
  onLeverageChange,
  onTrade,
  userProfile,
  isExecuting,
  openTrades,
  realtimeAssets,
  onCloseTrade,
}) => {
  // Get real-time P&L updates every 500ms
  const { tradePnL, totalPnL, lastUpdated } = useRealtimePnL(openTrades);
  return (
    <div className="h-[200px]">
      <Tabs defaultValue="trading" className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-3 h-10 bg-muted/50 border border-border/30 rounded-lg shadow-sm">
          <TabsTrigger value="trading" className="text-xs font-medium">Trading Panel</TabsTrigger>
          <TabsTrigger value="open-trades" className="text-xs font-medium">Open Trades</TabsTrigger>
          <TabsTrigger value="orders" className="text-xs font-medium">Orders</TabsTrigger>
        </TabsList>
        
        {/* Trading Panel Tab */}
        <TabsContent value="trading" className="flex-1 mt-2 p-3 bg-card/90 backdrop-blur-sm border border-border/30 rounded-lg shadow-sm">
          <div className="h-full overflow-y-auto">
            {selectedAsset ? (
              <EnhancedTradingPanel
                selectedAsset={selectedAsset}
                amount={amount}
                leverage={leverage}
                onAmountChange={onAmountChange}
                onLeverageChange={onLeverageChange}
                onTrade={onTrade}
                userProfile={userProfile}
                isExecuting={isExecuting}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">Select an asset to start trading</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        {/* Open Trades Tab */}
        <TabsContent value="open-trades" className="flex-1 mt-2 p-3 bg-card/90 backdrop-blur-sm border border-border/30 rounded-lg shadow-sm">
          <div className="h-full overflow-y-auto">
            {openTrades.length > 0 ? (
              <div className="space-y-1">
                {/* Header with real-time indicator */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30 rounded-lg">
                  <div className="col-span-2">Symbol</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Entry</div>
                  <div className="col-span-2">Current</div>
                  <div className="col-span-2 flex items-center gap-1">
                    P&L
                    {lastUpdated && (
                      <Clock className="h-3 w-3 text-primary animate-pulse" />
                    )}
                  </div>
                  <div className="col-span-2">Action</div>
                </div>
                
                {/* Trades with real-time P&L */}
                {openTrades.map((trade) => {
                  const asset = realtimeAssets.find(a => a.id === trade.asset_id);
                  const realTimePnL = tradePnL[trade.id] ?? trade.pnl ?? 0;
                  
                  return (
                    <div key={trade.id} className="grid grid-cols-12 gap-2 px-3 py-2 bg-card/50 border border-border/50 rounded-lg hover:bg-card/80 transition-colors">
                      <div className="col-span-2">
                        <div className="text-sm font-medium">{trade.symbol}</div>
                        <div className="text-xs text-muted-foreground">{trade.leverage}x</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-sm">{trade.trade_type}</div>
                        <div className="text-xs text-muted-foreground">${trade.amount}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-sm font-mono">${trade.open_price.toFixed(4)}</div>
                      </div>
                      <div className="col-span-2">
                        {asset ? (
                          <div className="text-sm font-mono">${asset.price.toFixed(4)}</div>
                        ) : (
                          <div className="text-xs text-muted-foreground">--</div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <PulsingPnLIndicator 
                          pnl={realTimePnL} 
                          showIcon={true}
                        />
                      </div>
                      <div className="col-span-2">
                        <button
                          onClick={() => onCloseTrade(trade.id)}
                          disabled={isExecuting}
                          className="px-3 py-1 text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isExecuting ? "..." : "Close"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <TrendingUp className="h-8 w-8 mb-3 opacity-40" />
                <p className="text-sm font-medium">No Open Trades</p>
                <p className="text-xs">Your active positions will appear here</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        {/* Order Management Tab */}
        <TabsContent value="orders" className="flex-1 mt-2 p-3 bg-card/90 backdrop-blur-sm border border-border/30 rounded-lg shadow-sm">
          <div className="h-full overflow-hidden">
            <OrderManagement />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};