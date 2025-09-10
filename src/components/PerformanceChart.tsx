import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { formatLargeNumber } from '@/utils/numberFormatter';

interface PerformanceChartProps {
  trades: any[];
  initialBalance: number;
  className?: string;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  trades,
  initialBalance,
  className
}) => {
  const chartData = useMemo(() => {
    const closedTrades = trades.filter(trade => trade.status === 'closed');
    
    if (closedTrades.length === 0) {
      return [
        { 
          date: new Date().toLocaleDateString(), 
          equity: initialBalance,
          balance: initialBalance,
          pnl: 0
        }
      ];
    }

    let runningBalance = initialBalance;
    const data = [{ 
      date: 'Start', 
      equity: initialBalance,
      balance: initialBalance,
      pnl: 0
    }];

    closedTrades.forEach((trade, index) => {
      runningBalance += (trade.pnl || 0);
      data.push({
        date: new Date(trade.closed_at || trade.created_at).toLocaleDateString(),
        equity: runningBalance,
        balance: runningBalance,
        pnl: trade.pnl || 0
      });
    });

    return data;
  }, [trades, initialBalance]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover p-3 rounded-lg border border-border shadow-lg">
          <p className="text-sm font-medium text-popover-foreground">{label}</p>
          <p className="text-sm text-primary">
            Equity: <span className="font-semibold">${formatLargeNumber(data.equity).display}</span>
          </p>
          {data.pnl && (
            <p className={`text-sm ${data.pnl >= 0 ? 'text-trading-success' : 'text-trading-danger'}`}>
              P&L: <span className="font-semibold">{data.pnl >= 0 ? '+' : ''}${formatLargeNumber(data.pnl).display}</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickFormatter={(value) => `$${formatLargeNumber(value).display}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="hsl(var(--primary))"
            fillOpacity={1}
            fill="url(#equityGradient)"
            strokeWidth={3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};