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
      
      // Set up real-time subscription for trade updates with enhanced handling
      const channel = supabase
        .channel('trades-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'trades',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Trade update received:', payload);
            
            if (payload.eventType === 'INSERT') {
              const newTrade = payload.new as Trade;
              console.log('New trade inserted:', newTrade.id, newTrade.status);
              setTrades(prev => {
                // Prevent duplicates
                if (prev.some(t => t.id === newTrade.id)) return prev;
                return [...prev, newTrade];
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedTrade = payload.new as Trade;
              console.log('Trade updated via real-time:', updatedTrade.id, 'status:', updatedTrade.status);
              setTrades(prev => prev.map(trade => 
                trade.id === updatedTrade.id ? updatedTrade : trade
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
      console.log('Opening trade:', { assetId, symbol, tradeType, amount, leverage, openPrice, marginUsed });
      
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

      console.log('Trade opened successfully:', data);
      console.log('New trade ID:', data.id, 'Margin used:', marginUsed);
      
      // Don't show toast here - let WebTrader handle it for better UX flow
      return data;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  };

  const closeTrade = async (tradeId: string, closePrice: number) => {
    console.log('Closing trade:', tradeId, 'at price:', closePrice);
    
    try {
      // Optimistically update local state to immediately remove from open trades
      setTrades(prev => prev.map(trade => 
        trade.id === tradeId 
          ? { ...trade, status: 'closed' as const, close_price: closePrice, closed_at: new Date().toISOString() }
          : trade
      ));

      // Get the trade and asset information
      const { data: tradeData, error: tradeError } = await supabase
        .from('trades')
        .select(`
          *,
          assets:asset_id (
            category,
            contract_size
          )
        `)
        .eq('id', tradeId)
        .single();

      if (tradeError || !tradeData) {
        console.error('Error fetching trade for closure:', tradeError);
        // Revert optimistic update
        setTrades(prev => prev.map(trade => 
          trade.id === tradeId 
            ? { ...trade, status: 'open' as const, close_price: undefined, closed_at: undefined }
            : trade
        ));
        toast({
          title: "Error",
          description: "Failed to fetch trade details",
          variant: "destructive",
        });
        return false;
      }

      // Calculate P&L using the database function which handles forex lots correctly
      const { data: pnlResult, error: pnlError } = await supabase
        .rpc('calculate_pnl', {
          trade_type: tradeData.trade_type,
          amount: tradeData.amount,
          open_price: tradeData.open_price,
          current_price: closePrice
        });

      if (pnlError) {
        console.error('Error calculating P&L:', pnlError);
        // Revert optimistic update
        setTrades(prev => prev.map(trade => 
          trade.id === tradeId 
            ? { ...trade, status: 'open' as const, close_price: undefined, closed_at: undefined }
            : trade
        ));
        toast({
          title: "Error",
          description: "Failed to calculate P&L",
          variant: "destructive",
        });
        return false;
      }

      // Update in database - triggers will handle balance/margin updates automatically
      const { error: updateError } = await supabase
        .from('trades')
        .update({
          close_price: closePrice,
          pnl: pnlResult,
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq('id', tradeId);

      if (updateError) {
        console.error('Error closing trade:', updateError);
        // Revert optimistic update
        setTrades(prev => prev.map(trade => 
          trade.id === tradeId 
            ? { ...trade, status: 'open' as const, close_price: undefined, closed_at: undefined }
            : trade
        ));
        toast({
          title: "Error",
          description: "Failed to close trade",
          variant: "destructive",
        });
        return false;
      }

      console.log('Trade closed successfully:', tradeId, 'P&L:', pnlResult);
      toast({
        title: "Trade Closed",
        description: `P&L: ${pnlResult >= 0 ? '+' : ''}$${pnlResult.toFixed(2)}`,
        variant: pnlResult >= 0 ? "default" : "destructive",
      });

      return true;
    } catch (error) {
      console.error('Error closing trade:', error);
      // Revert optimistic update on any error
      setTrades(prev => prev.map(trade => 
        trade.id === tradeId 
          ? { ...trade, status: 'open' as const, close_price: undefined, closed_at: undefined }
          : trade
      ));
      return false;
    }
  };

  const updateTradePnL = async (tradeId: string, currentPrice: number) => {
    const trade = trades.find(t => t.id === tradeId);
    if (!trade || trade.status !== 'open') {
      console.log('Skipping P&L update for trade:', tradeId, 'Status:', trade?.status);
      return;
    }

    try {
      // Use the database function to calculate P&L properly for all instrument types
      const { data: pnlResult, error: pnlError } = await supabase
        .rpc('calculate_pnl', {
          trade_type: trade.trade_type,
          amount: trade.amount,
          open_price: trade.open_price,
          current_price: currentPrice
        });

      if (pnlError) {
        console.error('Error calculating P&L:', pnlError);
        return;
      }

      // Only update if trade is still open (prevent race conditions)
      const currentTrade = trades.find(t => t.id === tradeId);
      if (!currentTrade || currentTrade.status !== 'open') {
        console.log('Trade status changed during P&L calculation, skipping update');
        return;
      }

      const { error } = await supabase
        .from('trades')
        .update({
          current_price: currentPrice,
          pnl: pnlResult,
        })
        .eq('id', tradeId)
        .eq('status', 'open'); // Only update if still open

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