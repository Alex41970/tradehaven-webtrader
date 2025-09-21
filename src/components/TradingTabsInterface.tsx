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
  // Get real-time P&L updates with asset contract sizes
  const { tradePnL, totalPnL, lastUpdated } = useRealtimePnL(openTrades, realtimeAssets);
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
              <div className="space-y-3">
                {/* Header for desktop only - hidden on mobile since TradeRow handles its own labels */}
                <div className="hidden md:flex text-xs font-medium text-muted-foreground px-4 py-2 bg-muted/30 rounded-lg items-center gap-1">
                  Open Positions
                  {lastUpdated && (
                    <Clock className="h-3 w-3 text-primary animate-pulse" />
                  )}
                </div>
                
                {/* Use TradeRow components for mobile-responsive layout */}
                {openTrades.map((trade) => {
                  const asset = realtimeAssets.find(a => a.id === trade.asset_id);
                  
                  return (
                    <TradeRow
                      key={trade.id}
                      trade={trade}
                      asset={asset}
                      onCloseTrade={async (tradeId: string, symbol: string) => onCloseTrade(tradeId)}
                      isClosing={isExecuting}
                    />
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