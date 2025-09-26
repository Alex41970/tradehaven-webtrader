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

    // Simplified channel setup with better error handling
    const channel = supabase
      .channel(channelName, {
        config: {
          presence: {
            key: channelName,
          },
        },
      })
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: table,
          ...(filter && { filter })
        },
        (payload) => {
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
        if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Failed to connect real-time updates for ${table}`);
        } else if (status === 'TIMED_OUT') {
          console.error(`⏰ Real-time connection timed out for ${table}`);
        }
      });

    subscriptionsRef.current.set(channelName, channel);
    return channelName;
  }, []);

  const unsubscribe = useCallback((subscriptionId: string) => {
    const channel = subscriptionsRef.current.get(subscriptionId);
    if (channel) {
      supabase.removeChannel(channel);
      subscriptionsRef.current.delete(subscriptionId);
    }
  }, []);

  const unsubscribeAll = useCallback(() => {
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

// REMOVED: Redundant Supabase Realtime hooks - Trading WebSocket already provides this data
// This saves thousands of real-time messages per hour by eliminating duplicate subscriptions:
// - useRealtimeUserProfile: Replaced by Trading WebSocket margin_updates
// - useRealtimeTrades: Replaced by Trading WebSocket trade_updates  
// - useRealtimeAssets: Price updates come from Price WebSocket, no need for asset table changes

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