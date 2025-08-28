import React from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, Activity, BarChart3 } from "lucide-react";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";

interface BotMetricsChartProps {
  trades: any[];
  balance: number;
}

export const BotMetricsChart: React.FC<BotMetricsChartProps> = ({ trades, balance }) => {
  const { metrics } = usePerformanceMetrics(trades, balance);
  
  // Generate equity curve data
  const equityCurveData = trades
    .filter(t => t.status === 'closed')
    .reduce((acc, trade, index) => {
      const prevEquity = acc[acc.length - 1]?.equity || balance;
      acc.push({
        trade: index + 1,
        equity: prevEquity + trade.pnl,
        pnl: trade.pnl,
        time: new Date(trade.closed_at).toLocaleDateString(),
      });
      return acc;
    }, [] as any[]);

  // Win/Loss ratio data
  const winLossData = [
    { name: 'Wins', value: metrics.profitableTrades, color: 'hsl(var(--trading-success))' },
    { name: 'Losses', value: metrics.losingTrades, color: 'hsl(var(--trading-danger))' },
  ];

  // Daily P&L data for area chart
  const dailyPnlData = trades
    .filter(t => t.status === 'closed')
    .reduce((acc, trade) => {
      const date = new Date(trade.closed_at).toDateString();
      const existing = acc.find(d => d.date === date);
      if (existing) {
        existing.pnl += trade.pnl;
      } else {
        acc.push({ date, pnl: trade.pnl, displayDate: new Date(trade.closed_at).toLocaleDateString() });
      }
      return acc;
    }, [] as any[])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7); // Last 7 days

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {/* Equity Curve */}
      <Card className="col-span-1 lg:col-span-2 border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-primary/5 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-trading-accent">
            <TrendingUp className="h-5 w-5" />
            Bot Equity Curve
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            {equityCurveData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityCurveData}>
                  <XAxis dataKey="trade" hide />
                  <YAxis hide />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    stroke="hsl(var(--trading-accent))"
                    strokeWidth={3}
                    dot={false}
                    strokeDasharray="none"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No closed trades yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Win/Loss Ratio */}
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-success/5 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-trading-success">
            <Target className="h-5 w-5" />
            Win Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center">
            {winLossData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={winLossData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    dataKey="value"
                  >
                    {winLossData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground">
                No data yet
              </div>
            )}
          </div>
          <div className="mt-4 text-center">
            <div className="text-2xl font-bold text-trading-success">
              {metrics.winRate.toFixed(1)}%
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily P&L Area Chart */}
      <Card className="col-span-1 lg:col-span-2 border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-accent/5 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-trading-accent">
            <BarChart3 className="h-5 w-5" />
            Daily Performance (Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32">
            {dailyPnlData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyPnlData}>
                  <XAxis dataKey="displayDate" hide />
                  <YAxis hide />
                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke="hsl(var(--trading-accent))"
                    fill="hsl(var(--trading-accent) / 0.2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No daily data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Metrics */}
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card/95 to-trading-secondary/5 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Advanced Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Profit Factor</span>
            <Badge variant={metrics.profitFactor >= 1.5 ? 'default' : 'secondary'}>
              {metrics.profitFactor.toFixed(2)}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Max Drawdown</span>
            <Badge variant="outline" className="text-trading-danger">
              -{metrics.maximumDrawdownPercent.toFixed(1)}%
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
            <Badge variant={metrics.sharpeRatio >= 1 ? 'default' : 'secondary'}>
              {metrics.sharpeRatio.toFixed(2)}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Expectancy</span>
            <Badge variant={metrics.expectancy >= 0 ? 'default' : 'destructive'}>
              ${metrics.expectancy.toFixed(2)}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};