import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { useRealTimeTrading } from './useRealTimeTrading';
import { supabase } from "@/integrations/supabase/client";

export interface Trade {
  id: string;
  user_id: string;
  asset_id: string;
  symbol: string;
  trade_type: 'BUY' | 'SELL';
  amount: number;
  leverage: number;
  open_price: number;
  close_price?: number;
  current_price?: number;
  pnl: number;
  margin_used: number;
  status: 'open' | 'closed';
  trade_source: 'bot' | 'user';
  opened_at: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  stop_loss_price?: number;
  take_profit_price?: number;
}

export const useTrades = () => {
  const { user } = useAuth();
  const [dbTrades, setDbTrades] = useState<Trade[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  
  const { 
    trades: realtimeTrades, 
    loading: realtimeLoading,
    isConnected,
    openTrade: realtimeOpenTrade,
    closeTrade: realtimeCloseTrade
  } = useRealTimeTrading();

  const fetchTrades = useCallback(async () => {
    if (!user) {
      setDbLoading(false);
      return;
    }

    try {
      setDbLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDbTrades((data || []) as Trade[]);
    } catch {
      setDbTrades([]);
    } finally {
      setDbLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const trades = isConnected && realtimeTrades.length > 0 ? realtimeTrades : dbTrades;
  const loading = isConnected ? realtimeLoading : dbLoading;

  const openTrades = trades.filter(trade => trade.status === 'open');
  const closedTrades = trades.filter(trade => trade.status === 'closed');
  const botTrades = trades.filter(trade => trade.trade_source === 'bot');
  const userTrades = trades.filter(trade => trade.trade_source === 'user');
  const openBotTrades = trades.filter(trade => trade.status === 'open' && trade.trade_source === 'bot');
  const openUserTrades = trades.filter(trade => trade.status === 'open' && trade.trade_source === 'user');
  const closedBotTrades = trades.filter(trade => trade.status === 'closed' && trade.trade_source === 'bot');
  const closedUserTrades = trades.filter(trade => trade.status === 'closed' && trade.trade_source === 'user');

  const openTrade = async (
    assetId: string,
    symbol: string,
    tradeType: 'BUY' | 'SELL',
    amount: number,
    leverage: number,
    openPrice: number,
    marginUsed: number,
    stopLoss?: number,
    takeProfit?: number
  ) => {
    if (!user) return null;

    try {
      if (isConnected) {
        await realtimeOpenTrade(assetId, symbol, tradeType, amount, leverage, openPrice, marginUsed, stopLoss, takeProfit);
      } else {
        const { error } = await supabase
          .from('trades')
          .insert({
            user_id: user.id,
            asset_id: assetId,
            symbol,
            trade_type: tradeType,
            amount,
            leverage,
            open_price: openPrice,
            current_price: openPrice,
            margin_used: marginUsed,
            stop_loss_price: stopLoss,
            take_profit_price: takeProfit,
            status: 'open',
            trade_source: 'user',
            pnl: 0
          })
          .select()
          .single();

        if (error) throw error;
        await fetchTrades();
      }
      
      return true;
    } catch (error) {
      throw error;
    }
  };

  const closeTrade = async (tradeId: string, closePrice: number) => {
    try {
      if (isConnected) {
        await realtimeCloseTrade(tradeId, closePrice);
      } else {
        const { data: result, error } = await supabase
          .rpc('close_trade_with_pnl', {
            p_trade_id: tradeId,
            p_close_price: closePrice
          });

        if (error) throw error;

        const rpcResult = result as any;
        if (rpcResult?.error) {
          throw new Error(rpcResult.error);
        }

        await fetchTrades();
      }
      
      return true;
    } catch (error) {
      throw error;
    }
  };

  return {
    trades,
    openTrades,
    closedTrades,
    botTrades,
    userTrades,
    openBotTrades,
    openUserTrades,
    closedBotTrades,
    closedUserTrades,
    loading,
    refetch: fetchTrades,
    openTrade,
    closeTrade,
    updateTradePnL: async () => {},
    recalculateMargins: async () => true,
  };
};
