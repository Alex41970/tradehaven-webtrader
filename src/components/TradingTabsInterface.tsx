import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { TradeRow } from "./TradeRow";
import { EnhancedTradingPanel } from "./EnhancedTradingPanel";
import { OrderManagement } from "./OrderManagement";
import { TrendingUp } from "lucide-react";

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
  return (
    <Card className="bg-card/80 backdrop-blur border-border/50 h-[200px]">
      <Tabs defaultValue="open-trades" className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-3 h-9 mx-4 mt-4">
          <TabsTrigger value="open-trades" className="text-xs">Open Trades</TabsTrigger>
          <TabsTrigger value="orders" className="text-xs">Order Management</TabsTrigger>
          <TabsTrigger value="trading" className="text-xs">Trading Panel</TabsTrigger>
        </TabsList>
        
        {/* Open Trades Tab */}
        <TabsContent value="open-trades" className="flex-1 mt-2 mx-4 mb-4">
          <div className="h-full overflow-y-auto space-y-2">
            {openTrades.length > 0 ? (
              openTrades.map((trade) => {
                const asset = realtimeAssets.find(a => a.id === trade.asset_id);
                return (
                  <div key={trade.id} className="p-2 bg-muted/10 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-sm font-medium">{trade.symbol}</div>
                          <div className="text-xs text-muted-foreground">
                            {trade.trade_type} • {trade.amount} • {trade.leverage}x
                          </div>
                        </div>
                        <div className="text-xs">
                          <div>Entry: ${trade.open_price.toFixed(4)}</div>
                          {asset && (
                            <div>Current: ${asset.price.toFixed(4)}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`text-sm font-medium ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                        </div>
                        <button
                          onClick={() => onCloseTrade(trade.id)}
                          disabled={isExecuting}
                          className="px-2 py-1 text-xs bg-destructive/10 hover:bg-destructive/20 text-destructive rounded border border-destructive/20 disabled:opacity-50"
                        >
                          {isExecuting ? "Closing..." : "Close"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No open trades</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        {/* Order Management Tab */}
        <TabsContent value="orders" className="flex-1 mt-2 mx-4 mb-4">
          <div className="h-full overflow-hidden">
            <OrderManagement />
          </div>
        </TabsContent>
        
        {/* Trading Panel Tab */}
        <TabsContent value="trading" className="flex-1 mt-2 mx-4 mb-4">
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
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Select an asset to start trading</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};