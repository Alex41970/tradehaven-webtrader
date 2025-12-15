import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

export interface TradeOrder {
  id: string;
  user_id: string;
  asset_id: string;
  symbol: string;
  order_type: 'market' | 'limit' | 'stop';
  trade_type: 'BUY' | 'SELL';
  amount: number;
  leverage: number;
  trigger_price?: number;
  stop_loss_price?: number;
  take_profit_price?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'expired';
  expires_at?: string;
  filled_at?: string;
  created_at: string;
  updated_at: string;
}

const POLL_INTERVAL = 30000; // 30 seconds polling

export const useTradeOrders = () => {
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('trade_orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to fetch trade orders",
          variant: "destructive",
        });
        return;
      }

      setOrders(data as TradeOrder[] || []);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch and polling setup
  useEffect(() => {
    if (user) {
      fetchOrders();
      
      // Set up polling instead of Realtime subscription
      pollIntervalRef.current = setInterval(fetchOrders, POLL_INTERVAL);
    } else {
      setOrders([]);
      setLoading(false);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [user, fetchOrders]);

  const createOrder = async (orderData: Omit<TradeOrder, 'id' | 'user_id' | 'status' | 'created_at' | 'updated_at'>) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create orders",
        variant: "destructive",
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('trade_orders')
        .insert([{
          ...orderData,
          user_id: user.id,
        }])
        .select()
        .single();

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create order",
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Success",
        description: "Order created successfully",
      });

      // Immediately refetch to update the list
      await fetchOrders();

      return data as TradeOrder;
    } catch {
      return null;
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('trade_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('user_id', user?.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to cancel order",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Success",
        description: "Order cancelled successfully",
      });

      // Immediately refetch to update the list
      await fetchOrders();

      return true;
    } catch {
      return false;
    }
  };

  return {
    orders,
    loading,
    createOrder,
    cancelOrder,
    refetch: fetchOrders,
    pendingOrders: orders.filter(order => order.status === 'pending'),
    filledOrders: orders.filter(order => order.status === 'filled'),
  };
};
