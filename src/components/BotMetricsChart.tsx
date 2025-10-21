import React from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, ComposedChart, Area, CartesianGrid, ReferenceLine, Label } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, Activity, BarChart3 } from "lucide-react";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";

interface BotMetricsChartProps {
  trades: any[];
  balance: number;
}

export const BotMetricsChart: React.FC<BotMetricsChartProps> = ({ trades, balance }) => {
  const { metrics } = usePerformanceMetrics(trades, balance);

  // Chart configurations
  const chartConfig = {
    equity: {
      label: "Equity",
      color: "hsl(var(--trading-accent))",
    },
    wins: {
      label: "Wins",
      color: "hsl(var(--trading-success))",
    },
    losses: {
      label: "Losses",
      color: "hsl(var(--trading-danger))",
    },
    pnl: {
      label: "P&L",
      color: "hsl(var(--trading-accent))",
    }
  };
  
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
      <Card className="col-span-1 lg:col-span-2 border-primary/20 bg-gradient-to-br from-card/50 via-card to-trading-primary/10 backdrop-blur-xl hover:scale-[1.01] transition-all duration-300 hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-trading-accent">
            <TrendingUp className="h-5 w-5" />
            Bot Equity Curve
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {equityCurveData.length > 0 ? (
              <ChartContainer config={chartConfig}>
                <ComposedChart data={equityCurveData}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--trading-accent))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--trading-accent))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                  <XAxis 
                    dataKey="trade" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    stroke="none"
                    fill="url(#equityGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    stroke="hsl(var(--trading-accent))"
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--trading-accent))", r: 4, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    activeDot={{ r: 6, fill: "hsl(var(--trading-accent))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No closed trades yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Win/Loss Ratio */}
      <Card className="border-primary/20 bg-gradient-to-br from-card/50 via-card to-trading-success/10 backdrop-blur-xl hover:scale-[1.01] transition-all duration-300 hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-trading-success">
            <Target className="h-5 w-5" />
            Win Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center relative">
            {winLossData.some(d => d.value > 0) ? (
              <>
                <ChartContainer config={chartConfig}>
                  <PieChart>
                    <Pie
                      data={winLossData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {winLossData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-trading-success">
                      {metrics.winRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Win Rate</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground">
                No data yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Daily P&L Bar Chart */}
      <Card className="col-span-1 lg:col-span-2 border-primary/20 bg-gradient-to-br from-card/50 via-card to-trading-accent/10 backdrop-blur-xl hover:scale-[1.01] transition-all duration-300 hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-trading-accent">
            <BarChart3 className="h-5 w-5" />
            Daily Performance (Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {dailyPnlData.length > 0 ? (
              <ChartContainer config={chartConfig}>
                <BarChart data={dailyPnlData}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--trading-success))" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="hsl(var(--trading-success))" stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--trading-danger))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--trading-danger))" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                  <XAxis 
                    dataKey="displayDate" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    cursor={{ fill: 'hsl(var(--muted) / 0.1)' }}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={2} />
                  <Bar 
                    dataKey="pnl" 
                    radius={[8, 8, 0, 0]}
                    fill="url(#profitGradient)"
                  >
                    {dailyPnlData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.pnl >= 0 ? "url(#profitGradient)" : "url(#lossGradient)"} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No daily data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Metrics */}
      <Card className="border-primary/20 bg-gradient-to-br from-card/50 via-card to-trading-secondary/10 backdrop-blur-xl hover:scale-[1.01] transition-all duration-300 hover:shadow-lg">
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