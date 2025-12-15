import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

interface SmartPriceSubscriptionResult {
  isConnected: boolean;
  lastUpdate: Date | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'paused';
  isUserActive: boolean;
}

/**
 * Simplified activity-aware presence hook
 * Only tracks user presence to signal the relay that users are online
 * Prices are loaded from database on mount - NO broadcast channel needed
 */
export const useSmartPriceSubscription = (): SmartPriceSubscriptionResult => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'paused'>('disconnected');
  const [isUserActive, setIsUserActive] = useState(true);

  const presenceChannelRef = useRef<any>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const activityTimeoutMs = 3 * 60 * 1000; // 3 minutes

  // Track user activity
  const handleUserActivity = useCallback(() => {
    if (!isUserActive) {
      logger.debug('🟢 User became active');
      setIsUserActive(true);
    }

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      logger.debug('🔴 User inactive - pausing');
      setIsUserActive(false);
    }, activityTimeoutMs);
  }, [isUserActive]);

  // Set up activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    handleUserActivity();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });
      
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [handleUserActivity]);

  // Handle page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logger.debug('🔇 Page hidden');
        setConnectionStatus('paused');
      } else {
        logger.debug('🔊 Page visible');
        if (isUserActive) {
          setConnectionStatus('connecting');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isUserActive]);

  // Manage presence tracking only - this signals the relay that users are online
  useEffect(() => {
    if (!isUserActive || document.hidden) {
      if (presenceChannelRef.current) {
        logger.debug('👋 Leaving presence channel');
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
        setIsConnected(false);
        setConnectionStatus('paused');
      }
      return;
    }

    logger.debug('👋 Joining presence channel');
    setConnectionStatus('connecting');
    
    const presenceChannel = supabase.channel('price-relay-presence', {
      config: {
        presence: { key: crypto.randomUUID() },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const userCount = Object.keys(state).length;
        logger.debug(`👥 Active clients: ${userCount}`);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            user_id: (await supabase.auth.getUser()).data.user?.id || 'anonymous',
          });
          logger.debug('✅ Presence tracked');
          setIsConnected(true);
          setConnectionStatus('connected');
          setLastUpdate(new Date());
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
          setConnectionStatus('disconnected');
        }
      });

    presenceChannelRef.current = presenceChannel;

    return () => {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
        setIsConnected(false);
      }
    };
  }, [isUserActive]);

  // Handle network reconnection
  useEffect(() => {
    const handleOnline = () => {
      logger.debug('🌐 Online');
      if (isUserActive && !document.hidden) {
        setConnectionStatus('connecting');
      }
    };

    const handleOffline = () => {
      logger.debug('🌐 Offline');
      setConnectionStatus('disconnected');
      setIsConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isUserActive]);

  // Keep edge function alive with periodic pings - every 10 minutes
  useEffect(() => {
    if (!isUserActive || document.hidden) return;

    const keepAlive = async () => {
      try {
        await supabase.functions.invoke('websocket-price-relay');
      } catch {
        // Silent fail - next ping will retry
      }
    };

    // Initial ping
    keepAlive();

    // Keep alive every 10 minutes (reduced from 5 minutes)
    const interval = setInterval(keepAlive, 600000);

    return () => clearInterval(interval);
  }, [isUserActive]);

  return {
    isConnected,
    lastUpdate,
    connectionStatus,
    isUserActive,
  };
};
