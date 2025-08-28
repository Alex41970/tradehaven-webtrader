import { useMemo, useState } from "react";
import { Trade } from "./useTrades";

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all-time';

export interface PerformanceMetrics {
  allTimeReturn: number;
  allTimeReturnPercent: number;
  periodPnL: number;
  periodReturnPercent: number;
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
    // Guard against undefined/null values
    if (!trades || !Array.isArray(trades) || balance === undefined || balance === null) {
      return {
        allTimeReturn: 0,
        allTimeReturnPercent: 0,
        periodPnL: 0,
        periodReturnPercent: 0,
        winRate: 0,
        totalTrades: 0,
        bestTrade: 0,
        worstTrade: 0,
        averageTradeSize: 0,
        profitableTrades: 0,
        losingTrades: 0,
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
        periodStart = new Date(0); // Beginning of time
        break;
    }

    // Filter trades for the selected period
    const periodTrades = trades.filter(trade => {
      const tradeDate = new Date(trade.opened_at);
      return tradeDate >= periodStart;
    });

    const closedTrades = periodTrades.filter(trade => trade.status === 'closed');
    
    // Calculate all-time metrics (always based on total balance)
    const initialBalance = 10000; // Starting balance
    const allTimeReturn = balance - initialBalance;
    const allTimeReturnPercent = ((balance - initialBalance) / initialBalance) * 100;
    
    // Calculate period metrics
    const periodPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const totalInvestedInPeriod = closedTrades.reduce((sum, trade) => sum + trade.amount, 0);
    
    // Calculate period return percentage based on amount invested in period
    const periodReturnPercent = totalInvestedInPeriod > 0 
      ? (periodPnL / totalInvestedInPeriod) * 100 
      : 0;
    
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
      allTimeReturn,
      allTimeReturnPercent,
      periodPnL,
      periodReturnPercent,
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