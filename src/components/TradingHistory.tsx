import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Loader2, Bot, User } from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import { useState } from "react";


export const TradingHistory = () => {
  const { closedTrades, closedBotTrades, closedUserTrades, loading } = useTrades();
  const [activeTab, setActiveTab] = useState('all');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter(trade => (trade.pnl || 0) > 0).length;
  const losingTrades = closedTrades.filter(trade => (trade.pnl || 0) < 0).length;
  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0';
  
  // Calculate Gross Profit (sum of all winning trades)
  const grossProfit = closedTrades
    .filter(trade => (trade.pnl || 0) > 0)
    .reduce((sum, trade) => sum + (trade.pnl || 0), 0);
  
  // Calculate Gross Loss (sum of all losing trades - will be negative)
  const grossLoss = closedTrades
    .filter(trade => (trade.pnl || 0) < 0)
    .reduce((sum, trade) => sum + (trade.pnl || 0), 0);
  
  // Net P&L = Gross Profit + Gross Loss (grossLoss is already negative)
  const netPnL = grossProfit + grossLoss;

  return (
    <div className="space-y-6">
      {/* Trading Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTrades}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {winningTrades} wins / {losingTrades} losses
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-success">{winRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Winning Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-success">{winningTrades}</div>
          </CardContent>
        </Card>
      </div>

      {/* P&L Breakdown */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-trading-success/30">
          <CardHeader>
            <CardTitle className="text-lg text-trading-success">Gross Profit</CardTitle>
            <CardDescription>Sum of all winning trades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-success">
              +${grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="border-trading-danger/30">
          <CardHeader>
            <CardTitle className="text-lg text-trading-danger">Gross Loss</CardTitle>
            <CardDescription>Sum of all losing trades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-trading-danger">
              ${grossLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className={netPnL >= 0 ? 'border-trading-success/30' : 'border-trading-danger/30'}>
          <CardHeader>
            <CardTitle className="text-lg">Net P&L</CardTitle>
            <CardDescription>Profit + Loss combined</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netPnL >= 0 ? 'text-trading-success' : 'text-trading-danger'}`}>
              {netPnL >= 0 ? '+' : ''}${netPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {grossProfit > 0 ? `+$${grossProfit.toLocaleString()}` : '$0'} {grossLoss < 0 ? `- $${Math.abs(grossLoss).toLocaleString()}` : '- $0'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trading History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trading History</CardTitle>
          <CardDescription>Your closed positions and performance</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All Trades</TabsTrigger>
              <TabsTrigger value="bot">Bot Trades</TabsTrigger>
              <TabsTrigger value="manual">Manual Trades</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {totalTrades === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No trading history available. Start trading to see your closed positions here.
                </div>
              ) : (
                <div className="space-y-4">
                  {closedTrades.map((trade) => {
                    const pnl = trade.pnl || 0;
                    const closeDate = trade.closed_at ? new Date(trade.closed_at) : new Date();
                    const formattedDate = closeDate.toISOString().split('T')[0];
                    const formattedTime = closeDate.toTimeString().split(' ')[0].substring(0, 5);

                    return (
                      <div key={trade.id} className="border rounded-lg p-4">
                        <div className="grid md:grid-cols-8 gap-4 items-center">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {trade.symbol}
                              {trade.trade_source === 'bot' ? (
                                <Bot className="h-4 w-4 text-primary" />
                              ) : (
                                <User className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <Badge variant={trade.trade_type === "BUY" ? "default" : "destructive"}>
                              {trade.trade_type}
                            </Badge>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">Amount</div>
                            <div className="font-medium">${Number(trade.amount).toFixed(2)}</div>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">Open Price</div>
                            <div className="font-mono">{Number(trade.open_price).toFixed(trade.symbol.includes('JPY') ? 2 : 4)}</div>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">Close Price</div>
                            <div className="font-mono">{trade.close_price ? Number(trade.close_price).toFixed(trade.symbol.includes('JPY') ? 2 : 4) : 'N/A'}</div>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">P&L</div>
                            <div className={`font-medium flex items-center ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {pnl >= 0 ? (
                                <TrendingUp className="h-4 w-4 mr-1" />
                              ) : (
                                <TrendingDown className="h-4 w-4 mr-1" />
                              )}
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">Close Time</div>
                            <div className="text-sm">{formattedDate}</div>
                            <div className="text-xs text-muted-foreground">{formattedTime}</div>
                          </div>
                          
                          <div>
                            <Badge variant={trade.trade_source === 'bot' ? 'default' : 'secondary'}>
                              {trade.trade_source === 'bot' ? 'BOT' : 'MANUAL'}
                            </Badge>
                          </div>
                          
                          <div>
                            <Badge variant="secondary">CLOSED</Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="bot" className="mt-4">
              {closedBotTrades.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No bot trades yet. Bot trades will appear here when your admin executes trades on your behalf.
                </div>
              ) : (
                <div className="space-y-4">
                  {closedBotTrades.map((trade) => {
                    const pnl = trade.pnl || 0;
                    const closeDate = trade.closed_at ? new Date(trade.closed_at) : new Date();
                    const formattedDate = closeDate.toISOString().split('T')[0];
                    const formattedTime = closeDate.toTimeString().split(' ')[0].substring(0, 5);

                    return (
                      <div key={trade.id} className="border rounded-lg p-4 border-primary/30 bg-primary/5">
                        <div className="grid md:grid-cols-7 gap-4 items-center">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {trade.symbol}
                              <Bot className="h-4 w-4 text-primary" />
                            </div>
                            <Badge variant={trade.trade_type === "BUY" ? "default" : "destructive"}>
                              {trade.trade_type}
                            </Badge>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">Amount</div>
                            <div className="font-medium">${Number(trade.amount).toFixed(2)}</div>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">Open Price</div>
                            <div className="font-mono">{Number(trade.open_price).toFixed(trade.symbol.includes('JPY') ? 2 : 4)}</div>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">Close Price</div>
                            <div className="font-mono">{trade.close_price ? Number(trade.close_price).toFixed(trade.symbol.includes('JPY') ? 2 : 4) : 'N/A'}</div>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">P&L</div>
                            <div className={`font-medium flex items-center ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {pnl >= 0 ? (
                                <TrendingUp className="h-4 w-4 mr-1" />
                              ) : (
                                <TrendingDown className="h-4 w-4 mr-1" />
                              )}
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">Close Time</div>
                            <div className="text-sm">{formattedDate}</div>
                            <div className="text-xs text-muted-foreground">{formattedTime}</div>
                          </div>
                          
                          <div>
                            <Badge variant="default">BOT TRADE</Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="mt-4">
              {closedUserTrades.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No manual trades yet. Trades you execute manually will appear here.
                </div>
              ) : (
                <div className="space-y-4">
                  {closedUserTrades.map((trade) => {
                    const pnl = trade.pnl || 0;
                    const closeDate = trade.closed_at ? new Date(trade.closed_at) : new Date();
                    const formattedDate = closeDate.toISOString().split('T')[0];
                    const formattedTime = closeDate.toTimeString().split(' ')[0].substring(0, 5);

                    return (
                      <div key={trade.id} className="border rounded-lg p-4">
                        <div className="grid md:grid-cols-7 gap-4 items-center">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {trade.symbol}
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <Badge variant={trade.trade_type === "BUY" ? "default" : "destructive"}>
                              {trade.trade_type}
                            </Badge>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">Amount</div>
                            <div className="font-medium">${Number(trade.amount).toFixed(2)}</div>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">Open Price</div>
                            <div className="font-mono">{Number(trade.open_price).toFixed(trade.symbol.includes('JPY') ? 2 : 4)}</div>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">Close Price</div>
                            <div className="font-mono">{trade.close_price ? Number(trade.close_price).toFixed(trade.symbol.includes('JPY') ? 2 : 4) : 'N/A'}</div>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">P&L</div>
                            <div className={`font-medium flex items-center ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {pnl >= 0 ? (
                                <TrendingUp className="h-4 w-4 mr-1" />
                              ) : (
                                <TrendingDown className="h-4 w-4 mr-1" />
                              )}
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm text-muted-foreground">Close Time</div>
                            <div className="text-sm">{formattedDate}</div>
                            <div className="text-xs text-muted-foreground">{formattedTime}</div>
                          </div>
                          
                          <div>
                            <Badge variant="secondary">MANUAL</Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};