import { useCallback, useMemo } from 'react';
import { accountStore } from '@/services/account';
import { useAccount } from './useAccount';

export type { Trade } from '@/services/accountStore';

/**
 * The client's trades, from the shared account record. Every screen that calls this
 * sees the same list, so a trade closed on one screen is closed on all of them.
 */
export const useTrades = () => {
  const trades = useAccount((s) => s.trades);
  const loading = useAccount((s) => s.tradesLoading);

  const lists = useMemo(() => {
    const openTrades = trades.filter((t) => t.status === 'open');
    const closedTrades = trades.filter((t) => t.status === 'closed');
    return {
      openTrades,
      closedTrades,
      botTrades: trades.filter((t) => t.trade_source === 'bot'),
      userTrades: trades.filter((t) => t.trade_source === 'user'),
      openBotTrades: openTrades.filter((t) => t.trade_source === 'bot'),
      openUserTrades: openTrades.filter((t) => t.trade_source === 'user'),
      closedBotTrades: closedTrades.filter((t) => t.trade_source === 'bot'),
      closedUserTrades: closedTrades.filter((t) => t.trade_source === 'user'),
    };
  }, [trades]);

  const openTrade = useCallback((
    assetId: string,
    symbol: string,
    tradeType: 'BUY' | 'SELL',
    amount: number,
    leverage: number,
    openPrice: number,
    marginUsed: number,
    stopLoss?: number,
    takeProfit?: number,
  ) => accountStore.openTrade({ assetId, symbol, tradeType, amount, leverage, openPrice, marginUsed, stopLoss, takeProfit }), []);

  const closeTrade = useCallback(
    (tradeId: string, closePrice: number) => accountStore.closeTrade(tradeId, closePrice), []);

  return { trades, ...lists, loading, refetch: accountStore.refresh, openTrade, closeTrade };
};
