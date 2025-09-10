import React from 'react';
import { PremiumCard, PremiumCardContent } from '@/components/PremiumCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  User, 
  Shield, 
  Crown, 
  TrendingUp, 
  ArrowUpRight, 
  Plus, 
  Minus,
  Activity,
  Target
} from 'lucide-react';
import { formatLargeNumber, formatPercentage } from '@/utils/numberFormatter';

interface HeroStatsCardProps {
  user: any;
  profile: any;
  totalPnL: number;
  equity: number;
  marginLevel: number;
  onDepositClick: () => void;
  onWithdrawClick: () => void;
}

export const HeroStatsCard: React.FC<HeroStatsCardProps> = ({
  user,
  profile,
  totalPnL,
  equity,
  marginLevel,
  onDepositClick,
  onWithdrawClick
}) => {
  const performanceScore = Math.min(100, Math.max(0, 
    50 + (totalPnL / (profile?.balance || 1)) * 100
  ));

  const riskLevel = marginLevel;
  const getRiskColor = (risk: number) => {
    if (risk < 30) return 'text-trading-success';
    if (risk < 70) return 'text-accent';
    return 'text-trading-danger';
  };

  return (
    <PremiumCard glassmorphism glow gradient className="col-span-full lg:col-span-2">
      <PremiumCardContent className="p-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* User Profile Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary-foreground" />
                </div>
                <Badge className="absolute -top-1 -right-1 bg-trading-success text-white border-0 h-6 w-6 rounded-full p-0 flex items-center justify-center">
                  <Shield className="w-3 h-3" />
                </Badge>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-playfair text-foreground">
                    {profile?.first_name && profile?.surname 
                      ? `${profile.first_name} ${profile.surname}`
                      : 'Premium Trader'
                    }
                  </h2>
                  <Badge className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground border-0">
                    <Crown className="w-3 h-3 mr-1" />
                    Premium
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  ID: {user?.id?.slice(-8).toUpperCase()}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3">
              <Button 
                onClick={onDepositClick}
                className="flex-1 bg-gradient-to-r from-trading-success to-trading-success/80 hover:from-trading-success/90 hover:to-trading-success/70 text-white border-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Deposit
              </Button>
              <Button 
                onClick={onWithdrawClick}
                variant="outline"
                className="flex-1 border-trading-danger/20 text-trading-danger hover:bg-trading-danger hover:text-white"
              >
                <Minus className="w-4 h-4 mr-2" />
                Withdraw
              </Button>
            </div>
          </div>

          {/* Performance Overview */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold font-playfair mb-4 text-foreground">Portfolio Performance</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Account Balance</span>
                  <span className="font-bold text-lg text-foreground">
                    ${formatLargeNumber(profile?.balance || 0).display}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Current Equity</span>
                  <span className="font-bold text-lg text-primary">
                    ${formatLargeNumber(equity).display}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Unrealized P&L</span>
                  <div className="flex items-center gap-1">
                    {totalPnL >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-trading-success" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-trading-danger rotate-180" />
                    )}
                    <span className={`font-bold text-lg ${
                      totalPnL >= 0 ? 'text-trading-success' : 'text-trading-danger'
                    }`}>
                      {totalPnL >= 0 ? '+' : ''}${formatLargeNumber(totalPnL).display}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk & Performance Scores */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold font-playfair mb-4 text-foreground">Risk Analysis</h3>
              
              {/* Performance Score */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Performance Score</span>
                  <span className="font-bold text-primary">{performanceScore.toFixed(0)}/100</span>
                </div>
                <Progress value={performanceScore} className="h-3" />
              </div>
              
              {/* Risk Level */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Risk Level</span>
                  <span className={`font-bold ${getRiskColor(riskLevel)}`}>
                    {formatPercentage(riskLevel)}
                  </span>
                </div>
                <Progress 
                  value={riskLevel} 
                  className={`h-3 ${riskLevel > 70 ? '[&>div]:bg-trading-danger' : riskLevel > 30 ? '[&>div]:bg-accent' : '[&>div]:bg-trading-success'}`}
                />
                <p className="text-xs text-muted-foreground">
                  {riskLevel < 30 ? 'Conservative' : riskLevel < 70 ? 'Moderate' : 'Aggressive'} risk profile
                </p>
              </div>
            </div>
          </div>
        </div>
      </PremiumCardContent>
    </PremiumCard>
  );
};