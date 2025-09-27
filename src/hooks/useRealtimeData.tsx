import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { getActivityAwareSubscriptionManager } from '@/services/ActivityAwareSubscriptionManager';

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
    const subscriptionManager = getActivityAwareSubscriptionManager(supabase);
    
    return subscriptionManager.subscribe({
      channel: `realtime_${table}_${filter || 'all'}`,
      event: '*',
      schema: 'public',
      table: table,
      ...(filter && { filter }),
      callback: (payload) => {
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
    });
  }, []);

  const unsubscribe = useCallback((subscriptionId: string) => {
    const subscriptionManager = getActivityAwareSubscriptionManager(supabase);
    subscriptionManager.unsubscribe(subscriptionId);
  }, []);

  const unsubscribeAll = useCallback(() => {
    const subscriptionManager = getActivityAwareSubscriptionManager(supabase);
    subscriptionManager.cleanup();
  }, []);

  return {
    subscribe,
    unsubscribe,
    unsubscribeAll,
    activeSubscriptions: 0 // Managed by the activity-aware manager
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