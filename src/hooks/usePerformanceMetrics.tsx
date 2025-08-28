import { useMemo, useState } from "react";
import { Trade } from "./useTrades";

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all-time';

export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  periodPnL: number;
  winRate: number;
  totalTrades: number;
  bestTrade: number;
  worstTrade: number;
  averageTradeSize: number;
  profitableTrades: number;
  losingTrades: number;
}

export const usePerformanceMetrics = (trades: Trade[], balance: number) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all-time');

  const metrics = useMemo(() => {
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
        periodStart = new Date(0); // Beginning of time
        break;
    }

    // Filter trades for the selected period
    const periodTrades = trades.filter(trade => {
      const tradeDate = new Date(trade.opened_at);
      return tradeDate >= periodStart;
    });

    const closedTrades = periodTrades.filter(trade => trade.status === 'closed');
    
    // Calculate metrics
    const totalPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const initialBalance = 10000; // Starting balance
    const totalReturn = balance - initialBalance;
    const totalReturnPercent = ((balance - initialBalance) / initialBalance) * 100;
    
    const profitableTrades = closedTrades.filter(trade => (trade.pnl || 0) > 0).length;
    const losingTrades = closedTrades.filter(trade => (trade.pnl || 0) < 0).length;
    const winRate = closedTrades.length > 0 ? (profitableTrades / closedTrades.length) * 100 : 0;
    
    const pnlValues = closedTrades.map(trade => trade.pnl || 0);
    const bestTrade = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
    const worstTrade = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;
    
    const averageTradeSize = closedTrades.length > 0 
      ? closedTrades.reduce((sum, trade) => sum + trade.amount, 0) / closedTrades.length 
      : 0;

    return {
      totalReturn,
      totalReturnPercent,
      periodPnL: totalPnL,
      winRate,
      totalTrades: periodTrades.length,
      bestTrade,
      worstTrade,
      averageTradeSize,
      profitableTrades,
      losingTrades,
    };
  }, [trades, balance, selectedPeriod]);

  return {
    metrics,
    selectedPeriod,
    setSelectedPeriod,
  };
};