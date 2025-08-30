import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface RealtimeSubscriptionOptions {
  table: string;
  filter?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

/**
 * Enhanced real-time hook for comprehensive data synchronization
 */
export const useRealtimeData = () => {
  const { toast } = useToast();
  const subscriptionsRef = useRef<Map<string, any>>(new Map());

  const subscribe = useCallback(({
    table,
    filter,
    onInsert,
    onUpdate,
    onDelete
  }: RealtimeSubscriptionOptions) => {
    const channelName = `realtime_${table}_${filter || 'all'}`;
    
    // Remove existing subscription if any
    const existingChannel = subscriptionsRef.current.get(channelName);
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
      subscriptionsRef.current.delete(channelName);
    }

    console.log(`🔌 Setting up real-time subscription for: ${table}`, { filter });

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: table,
          filter: filter
        },
        (payload) => {
          console.log(`📡 Real-time ${payload.eventType} on ${table}:`, payload);

          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload);
              break;
            case 'UPDATE':
              onUpdate?.(payload);
              break;
            case 'DELETE':
              onDelete?.(payload);
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log(`📊 Subscription status for ${table}:`, status);
        
        if (status === 'SUBSCRIBED') {
          toast({
            title: "Real-time Connected",
            description: `Live updates enabled for ${table}`,
            duration: 2000,
          });
        } else if (status === 'CHANNEL_ERROR') {
          toast({
            title: "Connection Error",
            description: `Failed to connect real-time updates for ${table}`,
            variant: "destructive",
          });
        }
      });

    subscriptionsRef.current.set(channelName, channel);
    return channelName;
  }, [toast]);

  const unsubscribe = useCallback((subscriptionId: string) => {
    const channel = subscriptionsRef.current.get(subscriptionId);
    if (channel) {
      console.log(`🔌 Unsubscribing from: ${subscriptionId}`);
      supabase.removeChannel(channel);
      subscriptionsRef.current.delete(subscriptionId);
    }
  }, []);

  const unsubscribeAll = useCallback(() => {
    console.log('🔌 Unsubscribing from all real-time channels');
    subscriptionsRef.current.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    subscriptionsRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeAll();
    };
  }, [unsubscribeAll]);

  return {
    subscribe,
    unsubscribe,
    unsubscribeAll,
    activeSubscriptions: subscriptionsRef.current.size
  };
};

/**
 * Enhanced user profile hook with real-time updates
 */
export const useRealtimeUserProfile = (userId?: string) => {
  const { subscribe, unsubscribe } = useRealtimeData();
  const subscriptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const subscriptionId = subscribe({
      table: 'user_profiles',
      filter: `user_id=eq.${userId}`,
      onUpdate: (payload) => {
        console.log('🔄 Profile updated in real-time:', payload.new);
        
        // Trigger custom event for components to listen to
        window.dispatchEvent(new CustomEvent('profile_updated', {
          detail: payload.new
        }));
      }
    });

    subscriptionIdRef.current = subscriptionId;

    return () => {
      if (subscriptionIdRef.current) {
        unsubscribe(subscriptionIdRef.current);
      }
    };
  }, [userId, subscribe, unsubscribe]);
};

/**
 * Real-time trades hook
 */
export const useRealtimeTrades = (userId?: string) => {
  const { subscribe, unsubscribe } = useRealtimeData();
  const subscriptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const subscriptionId = subscribe({
      table: 'trades',
      filter: `user_id=eq.${userId}`,
      onInsert: (payload) => {
        console.log('📈 New trade created:', payload.new);
        window.dispatchEvent(new CustomEvent('trade_created', {
          detail: payload.new
        }));
      },
      onUpdate: (payload) => {
        console.log('📊 Trade updated:', payload.new);
        window.dispatchEvent(new CustomEvent('trade_updated', {
          detail: { old: payload.old, new: payload.new }
        }));
      },
      onDelete: (payload) => {
        console.log('🗑️ Trade deleted:', payload.old);
        window.dispatchEvent(new CustomEvent('trade_deleted', {
          detail: payload.old
        }));
      }
    });

    subscriptionIdRef.current = subscriptionId;

    return () => {
      if (subscriptionIdRef.current) {
        unsubscribe(subscriptionIdRef.current);
      }
    };
  }, [userId, subscribe, unsubscribe]);
};

/**
 * Real-time assets/prices hook
 */
export const useRealtimeAssets = () => {
  const { subscribe, unsubscribe } = useRealtimeData();
  const subscriptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const subscriptionId = subscribe({
      table: 'assets',
      onUpdate: (payload) => {
        console.log('💰 Asset price updated:', payload.new);
        window.dispatchEvent(new CustomEvent('asset_updated', {
          detail: payload.new
        }));
      }
    });

    subscriptionIdRef.current = subscriptionId;

    return () => {
      if (subscriptionIdRef.current) {
        unsubscribe(subscriptionIdRef.current);
      }
    };
  }, [subscribe, unsubscribe]);
};

/**
 * System health monitoring hook
 */
export const useSystemHealth = () => {
  const runHealthCheck = useCallback(async () => {
    try {
      console.log('🏥 Running system health check...');
      
      const { data, error } = await supabase.rpc('run_system_health_check');
      
      if (error) {
        console.error('Health check error:', error);
        throw error;
      }
      
      console.log('🏥 Health check results:', data);
      return data;
    } catch (error) {
      console.error('Failed to run health check:', error);
      throw error;
    }
  }, []);

  const autoFixIssues = useCallback(async () => {
    try {
      console.log('🔧 Running auto-fix...');
      
      const { data, error } = await supabase.rpc('auto_fix_detected_issues');
      
      if (error) {
        console.error('Auto-fix error:', error);
        throw error;
      }
      
      console.log('🔧 Auto-fix results:', data);
      return data;
    } catch (error) {
      console.error('Failed to run auto-fix:', error);
      throw error;
    }
  }, []);

  return {
    runHealthCheck,
    autoFixIssues
  };
};