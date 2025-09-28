import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { useRealTimeTrading } from './useRealTimeTrading';

import { supabase } from "@/integrations/supabase/client";
import { calculateRealTimePnL } from '@/utils/pnlCalculator';

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
  
  

  // Fallback database query
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
    } catch (error) {
      console.error('Error fetching trades from database:', error);
      setDbTrades([]);
    } finally {
      setDbLoading(false);
    }
  }, [user]);

  // Initial database load
  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Use real-time data if connected, fallback to database data
  const trades = isConnected && realtimeTrades.length > 0 ? realtimeTrades : dbTrades;
  const loading = isConnected ? realtimeLoading : dbLoading;

  // Derived data
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
      // Try WebSocket first if connected
      if (isConnected) {
        console.log('Opening trade via WebSocket:', { assetId, symbol, tradeType, amount, leverage, openPrice, marginUsed, stopLoss, takeProfit });
        await realtimeOpenTrade(assetId, symbol, tradeType, amount, leverage, openPrice, marginUsed, stopLoss, takeProfit);
      } else {
        // Fallback to direct database insertion
        console.log('Opening trade via database (WebSocket not connected)');
        const { data, error } = await supabase
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
        
        // Refresh database data
        await fetchTrades();
      }
      
      return true;
    } catch (error) {
      console.error('Error opening trade:', error);
      throw error;
    }
  };

  const closeTrade = async (tradeId: string, closePrice: number) => {
    try {
      // Try WebSocket first if connected
      if (isConnected) {
        console.log('Closing trade via WebSocket:', tradeId, 'at price:', closePrice);
        await realtimeCloseTrade(tradeId, closePrice);
      } else {
        // Fallback to direct database update
        console.log('Closing trade via database (WebSocket not connected)');
        
        // Get trade details for P&L calculation
        const { data: trade } = await supabase
          .from('trades')
          .select('*')
          .eq('id', tradeId)
          .single();

        if (!trade) throw new Error('Trade not found');

        // Calculate P&L
        const pnl = trade.trade_type === 'BUY' 
          ? (closePrice - trade.open_price) * trade.amount * trade.leverage
          : (trade.open_price - closePrice) * trade.amount * trade.leverage;

        // Update trade
        const { error } = await supabase
          .from('trades')
          .update({
            status: 'closed',
            close_price: closePrice,
            pnl,
            closed_at: new Date().toISOString()
          })
          .eq('id', tradeId);

        if (error) throw error;
        
        // Refresh database data
        await fetchTrades();
      }
      
      return true;
    } catch (error) {
      console.error('Error closing trade:', error);
      throw error;
    }
  };

  // Real-time P&L updates are now handled by the WebSocket system
  const updateTradePnL = async (tradeId: string, currentPrice: number) => {
    console.log('updateTradePnL called - now handled by real-time WebSocket system');
  };

  // Derived data is now provided by useRealTimeTrading

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
    updateTradePnL: async () => {}, // No longer needed with real-time system
    recalculateMargins: async () => true,
  };
};