import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { getActivityAwareSubscriptionManager } from '@/services/ActivityAwareSubscriptionManager';

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

export const useTradeOrders = () => {
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

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

  useEffect(() => {
    fetchOrders();

    if (!user) return;

    // Set up activity-aware real-time subscription
    const subscriptionManager = getActivityAwareSubscriptionManager(supabase);
    const subscriptionId = subscriptionManager.subscribe({
      channel: 'trade-orders-changes',
      event: '*',
      schema: 'public',
      table: 'trade_orders',
      filter: `user_id=eq.${user.id}`,
      callback: (payload) => {
        if (payload.eventType === 'INSERT') {
          setOrders(prev => [payload.new as TradeOrder, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(order => 
            order.id === payload.new.id ? payload.new as TradeOrder : order
          ));
        } else if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(order => order.id !== payload.old.id));
        }
      }
    });

    return () => {
      subscriptionManager.unsubscribe(subscriptionId);
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