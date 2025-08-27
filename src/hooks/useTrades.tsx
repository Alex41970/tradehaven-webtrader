import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";

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
  opened_at: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
}

export const useTrades = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTrades();
      
      // Set up real-time subscription for trade updates
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'trades',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setTrades(prev => [...prev, payload.new as Trade]);
            } else if (payload.eventType === 'UPDATE') {
              setTrades(prev => prev.map(trade => 
                trade.id === payload.new.id ? payload.new as Trade : trade
              ));
            } else if (payload.eventType === 'DELETE') {
              setTrades(prev => prev.filter(trade => trade.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setTrades([]);
      setLoading(false);
    }
  }, [user]);

  const fetchTrades = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('opened_at', { ascending: false });

      if (error) {
        console.error('Error fetching trades:', error);
        toast({
          title: "Error",
          description: "Failed to fetch trades",
          variant: "destructive",
        });
        return;
      }

      setTrades(data as Trade[] || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

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
          status: 'open'
        })
        .select()
        .single();

      if (error) {
        console.error('Error opening trade:', error);
        toast({
          title: "Error",
          description: "Failed to open trade",
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Trade Opened",
        description: `${tradeType} ${amount} ${symbol} at ${openPrice}`,
      });

      return data;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  };

  const closeTrade = async (tradeId: string, closePrice: number) => {
    try {
      // Calculate P&L
      const trade = trades.find(t => t.id === tradeId);
      if (!trade) return false;

      // Get asset to check if it's forex and get contract size
      const { data: asset } = await supabase
        .from('assets')
        .select('category, contract_size')
        .eq('id', trade.asset_id)
        .single();

      let pnl: number;
      if (asset?.category === 'forex') {
        // For forex: P&L = lot_size * contract_size * price_difference
        const priceDifference = trade.trade_type === 'BUY' 
          ? (closePrice - trade.open_price)
          : (trade.open_price - closePrice);
        pnl = trade.amount * (asset.contract_size || 100000) * priceDifference;
      } else {
        // For other instruments: P&L = amount * price_difference
        pnl = trade.trade_type === 'BUY' 
          ? trade.amount * (closePrice - trade.open_price)
          : trade.amount * (trade.open_price - closePrice);
      }

      const { error } = await supabase
        .from('trades')
        .update({
          close_price: closePrice,
          pnl,
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq('id', tradeId);

      if (error) {
        console.error('Error closing trade:', error);
        toast({
          title: "Error",
          description: "Failed to close trade",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Trade Closed",
        description: `P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
        variant: pnl >= 0 ? "default" : "destructive",
      });

      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  };

  const updateTradePnL = async (tradeId: string, currentPrice: number) => {
    const trade = trades.find(t => t.id === tradeId);
    if (!trade || trade.status !== 'open') return;

    // Get asset to check if it's forex and get contract size
    const { data: asset } = await supabase
      .from('assets')
      .select('category, contract_size')
      .eq('id', trade.asset_id)
      .single();

    let pnl: number;
    if (asset?.category === 'forex') {
      // For forex: P&L = lot_size * contract_size * price_difference
      const priceDifference = trade.trade_type === 'BUY' 
        ? (currentPrice - trade.open_price)
        : (trade.open_price - currentPrice);
      pnl = trade.amount * (asset.contract_size || 100000) * priceDifference;
    } else {
      // For other instruments: P&L = amount * price_difference
      pnl = trade.trade_type === 'BUY' 
        ? trade.amount * (currentPrice - trade.open_price)
        : trade.amount * (trade.open_price - currentPrice);
    }

    try {
      const { error } = await supabase
        .from('trades')
        .update({
          current_price: currentPrice,
          pnl,
        })
        .eq('id', tradeId);

      if (error) {
        console.error('Error updating trade P&L:', error);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const openTrades = trades.filter(trade => trade.status === 'open');
  const closedTrades = trades.filter(trade => trade.status === 'closed');

  return {
    trades,
    openTrades,
    closedTrades,
    loading,
    refetch: fetchTrades,
    openTrade,
    closeTrade,
    updateTradePnL,
  };
};