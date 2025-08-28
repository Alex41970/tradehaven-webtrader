import { useMemo, useState } from "react";
import { Trade } from "./useTrades";

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all-time';

export interface ProfessionalMetrics {
  // Core Performance
  profitFactor: number;
  sharpeRatio: number;
  maximumDrawdown: number;
  maximumDrawdownPercent: number;
  recoveryFactor: number;
  expectancy: number;
  
  // Current Status
  currentDrawdown: number;
  currentDrawdownPercent: number;
  
  // Risk Metrics
  averageRMultiple: number;
  winRate: number;
  
  // Streaks
  consecutiveWins: number;
  consecutiveLosses: number;
  longestWinStreak: number;
  longestLossStreak: number;
  
  // Trade Stats
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  largestWin: number;
  largestLoss: number;
  
  // Period specific
  periodReturn: number;
  periodReturnPercent: number;
}

export const useProfessionalMetrics = (trades: Trade[], balance: number) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all-time');

  const metrics = useMemo(() => {
    // Guard against undefined/null values
    if (!trades || !Array.isArray(trades) || balance === undefined || balance === null) {
      return {
        profitFactor: 0,
        sharpeRatio: 0,
        maximumDrawdown: 0,
        maximumDrawdownPercent: 0,
        recoveryFactor: 0,
        expectancy: 0,
        currentDrawdown: 0,
        currentDrawdownPercent: 0,
        averageRMultiple: 0,
        winRate: 0,
        consecutiveWins: 0,
        consecutiveLosses: 0,
        longestWinStreak: 0,
        longestLossStreak: 0,
        totalTrades: 0,
        profitableTrades: 0,
        losingTrades: 0,
        largestWin: 0,
        largestLoss: 0,
        periodReturn: 0,
        periodReturnPercent: 0,
      };
    }

    const now = new Date();
    let periodStart: Date;

    // Calculate period start date
    switch (selectedPeriod) {
      case 'daily':
        periodStart = new Date(now);
        periodStart.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        periodStart = new Date(now);
        periodStart.setMonth(now.getMonth() - 1);
        break;
      case 'yearly':
        periodStart = new Date(now);
        periodStart.setFullYear(now.getFullYear() - 1);
        break;
      case 'all-time':
      default:
        periodStart = new Date(0);
        break;
    }

    // Filter trades for the selected period
    const periodTrades = trades.filter(trade => {
      const tradeDate = new Date(trade.opened_at);
      return tradeDate >= periodStart;
    });

    const closedTrades = periodTrades.filter(trade => trade.status === 'closed');
    
    if (closedTrades.length === 0) {
      return {
        profitFactor: 0,
        sharpeRatio: 0,
        maximumDrawdown: 0,
        maximumDrawdownPercent: 0,
        recoveryFactor: 0,
        expectancy: 0,
        currentDrawdown: 0,
        currentDrawdownPercent: 0,
        averageRMultiple: 0,
        winRate: 0,
        consecutiveWins: 0,
        consecutiveLosses: 0,
        longestWinStreak: 0,
        longestLossStreak: 0,
        totalTrades: closedTrades.length,
        profitableTrades: 0,
        losingTrades: 0,
        largestWin: 0,
        largestLoss: 0,
        periodReturn: 0,
        periodReturnPercent: 0,
      };
    }

    // Basic trade metrics
    const pnlValues = closedTrades.map(trade => trade.pnl || 0);
    const profitableTrades = closedTrades.filter(trade => (trade.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(trade => (trade.pnl || 0) < 0);
    
    const totalProfit = profitableTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0));
    
    const largestWin = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
    const largestLoss = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;
    
    const winRate = (profitableTrades.length / closedTrades.length) * 100;
    
    // Calculate Profit Factor
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? totalProfit : 0;
    
    // Calculate Expectancy
    const expectancy = pnlValues.reduce((sum, pnl) => sum + pnl, 0) / closedTrades.length;
    
    // Calculate Average R-Multiple (simplified - using average risk as trade amount / 10)
    const avgRisk = closedTrades.reduce((sum, trade) => sum + trade.amount, 0) / closedTrades.length / 10;
    const averageRMultiple = avgRisk > 0 ? expectancy / avgRisk : 0;
    
    // Calculate drawdown metrics
    let runningBalance = selectedPeriod === 'all-time' ? 10000 : balance - closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    let peak = runningBalance;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    
    const sortedTrades = [...closedTrades].sort((a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime());
    
    for (const trade of sortedTrades) {
      runningBalance += (trade.pnl || 0);
      if (runningBalance > peak) {
        peak = runningBalance;
      }
      const drawdown = peak - runningBalance;
      const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
      
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }
    
    // Current drawdown (from current peak to current balance)
    const currentPeak = Math.max(peak, balance);
    const currentDrawdown = Math.max(0, currentPeak - balance);
    const currentDrawdownPercent = currentPeak > 0 ? (currentDrawdown / currentPeak) * 100 : 0;
    
    // Calculate Recovery Factor
    const totalReturn = pnlValues.reduce((sum, pnl) => sum + pnl, 0);
    const recoveryFactor = maxDrawdown > 0 ? totalReturn / maxDrawdown : totalReturn > 0 ? totalReturn : 0;
    
    // Calculate Sharpe Ratio (simplified - using standard deviation of returns)
    const avgReturn = expectancy;
    const returnVariance = pnlValues.reduce((sum, pnl) => sum + Math.pow(pnl - avgReturn, 2), 0) / closedTrades.length;
    const returnStdDev = Math.sqrt(returnVariance);
    const sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;
    
    // Calculate consecutive win/loss streaks
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    
    for (let i = sortedTrades.length - 1; i >= 0; i--) {
      const pnl = sortedTrades[i].pnl || 0;
      
      if (pnl > 0) {
        currentWinStreak++;
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
        if (i === sortedTrades.length - 1) consecutiveWins = currentWinStreak;
        currentLossStreak = 0;
      } else if (pnl < 0) {
        currentLossStreak++;
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
        if (i === sortedTrades.length - 1) consecutiveLosses = currentLossStreak;
        currentWinStreak = 0;
      }
    }
    
    // Period return
    const periodReturn = pnlValues.reduce((sum, pnl) => sum + pnl, 0);
    const totalInvested = closedTrades.reduce((sum, trade) => sum + trade.amount, 0);
    const periodReturnPercent = totalInvested > 0 ? (periodReturn / totalInvested) * 100 : 0;

    return {
      profitFactor,
      sharpeRatio,
      maximumDrawdown: maxDrawdown,
      maximumDrawdownPercent: maxDrawdownPercent,
      recoveryFactor,
      expectancy,
      currentDrawdown,
      currentDrawdownPercent,
      averageRMultiple,
      winRate,
      consecutiveWins,
      consecutiveLosses,
      longestWinStreak,
      longestLossStreak,
      totalTrades: closedTrades.length,
      profitableTrades: profitableTrades.length,
      losingTrades: losingTrades.length,
      largestWin,
      largestLoss,
      periodReturn,
      periodReturnPercent,
    };
  }, [trades, balance, selectedPeriod]);

  return {
    metrics,
    selectedPeriod,
    setSelectedPeriod,
  };
};

// Keep the old hook for backward compatibility during transition
export const usePerformanceMetrics = useProfessionalMetrics;