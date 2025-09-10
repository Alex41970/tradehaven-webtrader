import React from 'react';
import { PremiumCard, PremiumCardContent } from '@/components/PremiumCard';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Trophy, 
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Shield,
  Zap
} from 'lucide-react';
import { formatLargeNumber, formatPercentage } from '@/utils/numberFormatter';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<any>;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'success' | 'danger' | 'warning';
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend = 'neutral',
  color = 'primary',
  className
}) => {
  const colorClasses = {
    primary: 'text-primary',
    success: 'text-trading-success',
    danger: 'text-trading-danger',
    warning: 'text-accent'
  };

  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownLeft : Activity;

  return (
    <PremiumCard glassmorphism glow className={cn("group hover:scale-105 transition-transform duration-300", className)}>
      <PremiumCardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-full bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity", 
            color === 'primary' && "from-primary/20 to-primary/10",
            color === 'success' && "from-trading-success/20 to-trading-success/10",
            color === 'danger' && "from-trading-danger/20 to-trading-danger/10",
            color === 'warning' && "from-accent/20 to-accent/10"
          )}>
            <Icon className={cn("w-6 h-6", colorClasses[color])} />
          </div>
          {trend !== 'neutral' && (
            <Badge variant="outline" className={cn("flex items-center gap-1",
              trend === 'up' && "text-trading-success border-trading-success/20 bg-trading-success/5",
              trend === 'down' && "text-trading-danger border-trading-danger/20 bg-trading-danger/5"
            )}>
              <TrendIcon className="w-3 h-3" />
            </Badge>
          )}
        </div>
        
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-2xl font-bold font-playfair", colorClasses[color])}>{value}</span>
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </PremiumCardContent>
    </PremiumCard>
  );
};

interface MetricsGridProps {
  metrics: any;
  balance: number;
  totalPnL: number;
  equity: number;
  freeMargin: number;
  marginLevel?: number;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({
  metrics,
  balance,
  totalPnL,
  equity,
  freeMargin,
  marginLevel = 0
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Portfolio Value"
        value={`$${formatLargeNumber(balance)}`}
        subtitle="Account Balance"
        icon={DollarSign}
        color="primary"
        trend="neutral"
      />
      
      <MetricCard
        title="Total P&L"
        value={`$${formatLargeNumber(totalPnL)}`}
        subtitle={`${totalPnL >= 0 ? '+' : ''}${formatPercentage((totalPnL / balance) * 100)}`}
        icon={TrendingUp}
        color={totalPnL >= 0 ? 'success' : 'danger'}
        trend={totalPnL >= 0 ? 'up' : 'down'}
      />
      
      <MetricCard
        title="Win Rate"
        value={`${formatPercentage(metrics.winRate || 0)}`}
        subtitle={`${metrics.profitableTrades || 0}/${metrics.totalTrades || 0} trades`}
        icon={Trophy}
        color={metrics.winRate >= 50 ? 'success' : 'warning'}
        trend={metrics.winRate >= 50 ? 'up' : 'down'}
      />
      
      <MetricCard
        title="Free Margin"
        value={`$${formatLargeNumber(freeMargin)}`}
        subtitle={`${formatPercentage(marginLevel)}% used`}
        icon={Shield}
        color={marginLevel < 80 ? 'success' : marginLevel < 95 ? 'warning' : 'danger'}
        trend={marginLevel < 80 ? 'up' : 'down'}
      />
      
      <MetricCard
        title="Profit Factor"
        value={metrics.profitFactor?.toFixed(2) || '0.00'}
        subtitle="Gross Profit / Gross Loss"
        icon={Target}
        color={metrics.profitFactor >= 1.5 ? 'success' : metrics.profitFactor >= 1 ? 'warning' : 'danger'}
        trend={metrics.profitFactor >= 1 ? 'up' : 'down'}
      />
      
      <MetricCard
        title="Max Drawdown"
        value={`${formatPercentage(metrics.maxDrawdown || 0)}`}
        subtitle="Largest peak-to-trough decline"
        icon={TrendingDown}
        color={metrics.maxDrawdown <= 10 ? 'success' : metrics.maxDrawdown <= 20 ? 'warning' : 'danger'}
        trend="down"
      />
      
      <MetricCard
        title="Sharpe Ratio"
        value={metrics.sharpeRatio?.toFixed(2) || '0.00'}
        subtitle="Risk-adjusted return"
        icon={Zap}
        color={metrics.sharpeRatio >= 1 ? 'success' : metrics.sharpeRatio >= 0.5 ? 'warning' : 'danger'}
        trend={metrics.sharpeRatio >= 0.5 ? 'up' : 'down'}
      />
      
      <MetricCard
        title="Active Positions"
        value={metrics.activeTrades?.toString() || '0'}
        subtitle="Open trades"
        icon={Activity}
        color="primary"
        trend="neutral"
      />
    </div>
  );
};