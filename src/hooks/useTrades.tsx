import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./useAuth";
import { useRealTimeTrading } from './useRealTimeTrading';
import { useRealTimePrices } from './useRealTimePrices';
import { useRealtimeTrades } from './useRealtimeData';
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
  
  const { getUpdatedAssets } = useRealTimePrices();

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

  // Subscribe to Supabase realtime trades as a fallback when WS is disconnected
  useRealtimeTrades(user?.id);

  // Keep dbTrades in sync with realtime DB events
  useEffect(() => {
    const onCreated = (e: any) => {
      const t = e.detail;
      if (!t) return;
      setDbTrades(prev => [t as Trade, ...prev.filter(p => p.id !== t.id)]);
    };
    const onUpdated = (e: any) => {
      const t = (e.detail?.new ?? e.detail) as Trade;
      if (!t) return;
      setDbTrades(prev => prev.map(p => (p.id === t.id ? t : p)));
    };
    const onDeleted = (e: any) => {
      const t = e.detail as Trade;
      if (!t) return;
      setDbTrades(prev => prev.filter(p => p.id !== t.id));
    };
    window.addEventListener('trade_created', onCreated as EventListener);
    window.addEventListener('trade_updated', onUpdated as EventListener);
    window.addEventListener('trade_deleted', onDeleted as EventListener);
    return () => {
      window.removeEventListener('trade_created', onCreated as EventListener);
      window.removeEventListener('trade_updated', onUpdated as EventListener);
      window.removeEventListener('trade_deleted', onDeleted as EventListener);
    };
  }, []);

  // Merge WebSocket and DB data intelligently - freshest wins by ID
  const trades = useMemo(() => {
    if (!isConnected || realtimeTrades.length === 0) {
      return dbTrades;
    }
    
    if (dbTrades.length === 0) {
      return realtimeTrades;
    }
    
    // Merge both sources - WebSocket takes precedence for existing IDs
    const mergedMap = new Map<string, Trade>();
    
    // Start with DB trades
    dbTrades.forEach(trade => mergedMap.set(trade.id, trade));
    
    // Override with WebSocket trades (fresher data)
    realtimeTrades.forEach(trade => mergedMap.set(trade.id, trade));
    
    const merged = Array.from(mergedMap.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return merged;
  }, [isConnected, realtimeTrades, dbTrades]);
  
  const loading = realtimeLoading || dbLoading;

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
    marginUsed: number
  ) => {
    if (!user) return null;

    try {
      // Try WebSocket first if connected
      if (isConnected) {
        console.log('Opening trade via WebSocket:', { assetId, symbol, tradeType, amount, leverage, openPrice, marginUsed });
        await realtimeOpenTrade(assetId, symbol, tradeType, amount, leverage, openPrice, marginUsed);
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
        
        // Recalculate margins server-side and let realtime profile update propagate
        try {
          if (user?.id) {
            await supabase.functions.invoke('fix-user-margins', { body: { user_id: user.id } });
          }
        } catch (e) {
          console.error('Error invoking fix-user-margins:', e);
        }
        
        // Refresh database data as a safety net
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