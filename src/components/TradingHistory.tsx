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
  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0';
  const totalPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);

  return (
    <div className="space-y-6">
      {/* Trading Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTrades}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{winRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Winning Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{winningTrades}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </div>
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