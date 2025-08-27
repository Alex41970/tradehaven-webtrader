import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

const DEMO_HISTORY = [
  {
    id: 1,
    symbol: "GBPUSD",
    type: "BUY",
    amount: 750,
    openPrice: 1.2680,
    closePrice: 1.2695,
    pnl: 11.25,
    openTime: "2024-01-14 08:15",
    closeTime: "2024-01-14 15:30",
    status: "CLOSED"
  },
  {
    id: 2,
    symbol: "USDJPY",
    type: "SELL",
    amount: 300,
    openPrice: 148.50,
    closePrice: 149.25,
    pnl: -22.50,
    openTime: "2024-01-13 11:20",
    closeTime: "2024-01-13 16:45",
    status: "CLOSED"
  },
  {
    id: 3,
    symbol: "TSLA",
    type: "BUY",
    amount: 400,
    openPrice: 255.10,
    closePrice: 248.87,
    pnl: -24.92,
    openTime: "2024-01-12 14:30",
    closeTime: "2024-01-12 18:15",
    status: "CLOSED"
  },
  {
    id: 4,
    symbol: "EURUSD",
    type: "BUY",
    amount: 1200,
    openPrice: 1.0790,
    closePrice: 1.0815,
    pnl: 30.00,
    openTime: "2024-01-11 09:45",
    closeTime: "2024-01-11 14:20",
    status: "CLOSED"
  }
];

export const TradingHistory = () => {
  const totalTrades = DEMO_HISTORY.length;
  const winningTrades = DEMO_HISTORY.filter(trade => trade.pnl > 0).length;
  const winRate = ((winningTrades / totalTrades) * 100).toFixed(1);
  const totalPnL = DEMO_HISTORY.reduce((sum, trade) => sum + trade.pnl, 0);

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
          <div className="space-y-4">
            {DEMO_HISTORY.map((trade) => (
              <div key={trade.id} className="border rounded-lg p-4">
                <div className="grid md:grid-cols-7 gap-4 items-center">
                  <div>
                    <div className="font-medium">{trade.symbol}</div>
                    <Badge variant={trade.type === "BUY" ? "default" : "destructive"}>
                      {trade.type}
                    </Badge>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Amount</div>
                    <div className="font-medium">${trade.amount}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Open Price</div>
                    <div className="font-mono">{trade.openPrice}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Close Price</div>
                    <div className="font-mono">{trade.closePrice}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">P&L</div>
                    <div className={`font-medium flex items-center ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.pnl >= 0 ? (
                        <TrendingUp className="h-4 w-4 mr-1" />
                      ) : (
                        <TrendingDown className="h-4 w-4 mr-1" />
                      )}
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Close Time</div>
                    <div className="text-sm">{trade.closeTime.split(' ')[0]}</div>
                    <div className="text-xs text-muted-foreground">{trade.closeTime.split(' ')[1]}</div>
                  </div>
                  
                  <div>
                    <Badge variant="secondary">{trade.status}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};