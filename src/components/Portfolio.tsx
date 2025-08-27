import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown } from "lucide-react";

const DEMO_POSITIONS = [
  {
    id: 1,
    symbol: "EURUSD",
    type: "BUY",
    amount: 1000,
    openPrice: 1.0823,
    currentPrice: 1.0845,
    pnl: 22.00,
    pnlPercent: 2.2,
    leverage: 10,
    openTime: "2024-01-15 10:30"
  },
  {
    id: 2,
    symbol: "AAPL",
    type: "BUY",
    amount: 500,
    openPrice: 171.30,
    currentPrice: 173.45,
    pnl: 12.75,
    pnlPercent: 1.26,
    leverage: 5,
    openTime: "2024-01-15 09:15"
  },
  {
    id: 3,
    symbol: "BTCUSD",
    type: "SELL",
    amount: 200,
    openPrice: 44500.00,
    currentPrice: 43250.00,
    pnl: 25.00,
    pnlPercent: 2.81,
    leverage: 20,
    openTime: "2024-01-14 14:22"
  }
];

export const Portfolio = () => {
  const totalPnL = DEMO_POSITIONS.reduce((sum, pos) => sum + pos.pnl, 0);

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{DEMO_POSITIONS.length}</div>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Used Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$1,700</div>
          </CardContent>
        </Card>
      </div>

      {/* Positions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Open Positions</CardTitle>
          <CardDescription>Manage your active trades</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {DEMO_POSITIONS.map((position) => (
              <div key={position.id} className="border rounded-lg p-4">
                <div className="grid md:grid-cols-6 gap-4 items-center">
                  <div>
                    <div className="font-medium">{position.symbol}</div>
                    <Badge variant={position.type === "BUY" ? "default" : "destructive"}>
                      {position.type}
                    </Badge>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Amount</div>
                    <div className="font-medium">${position.amount}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Open Price</div>
                    <div className="font-mono">{position.openPrice}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Current Price</div>
                    <div className="font-mono">{position.currentPrice}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">P&L</div>
                    <div className={`font-medium flex items-center ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {position.pnl >= 0 ? (
                        <TrendingUp className="h-4 w-4 mr-1" />
                      ) : (
                        <TrendingDown className="h-4 w-4 mr-1" />
                      )}
                      {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">
                      Modify
                    </Button>
                    <Button size="sm" variant="destructive">
                      Close
                    </Button>
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