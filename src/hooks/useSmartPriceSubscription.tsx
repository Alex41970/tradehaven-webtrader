import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
  source?: string;
}

interface SmartPriceSubscriptionResult {
  prices: Map<string, PriceUpdate>;
  isConnected: boolean;
  lastUpdate: Date | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'paused';
  isUserActive: boolean;
}

/**
 * Activity-aware price subscription hook
 * Automatically subscribes/unsubscribes based on user activity
 * Tracks presence and manages connection lifecycle
 */
export const useSmartPriceSubscription = (): SmartPriceSubscriptionResult => {
  const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'paused'>('disconnected');
  const [isUserActive, setIsUserActive] = useState(true);

  const channelRef = useRef<any>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutMs = 3 * 60 * 1000; // 3 minutes

  // Track user activity
  const handleUserActivity = useCallback(() => {
    if (!isUserActive) {
      logger.debug('🟢 User became active - resuming subscriptions');
      setIsUserActive(true);
    }

    // Reset inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      logger.debug('🔴 User inactive for 3 minutes - pausing subscriptions');
      setIsUserActive(false);
    }, activityTimeoutMs);
  }, [isUserActive]);

  // Set up activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Initial activity registration
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
        logger.debug('🔇 Page hidden - marking as paused');
        setConnectionStatus('paused');
      } else {
        logger.debug('🔊 Page visible - resuming');
        if (isUserActive) {
          setConnectionStatus('connecting');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isUserActive]);

  // Manage Supabase Realtime subscription
  useEffect(() => {
    if (!isUserActive || document.hidden) {
      // Unsubscribe when inactive or hidden
      if (channelRef.current) {
        logger.debug('🔌 Unsubscribing from price updates (inactive/hidden)');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
        setConnectionStatus('paused');
      }
      return;
    }

    // Subscribe when active and visible
    logger.debug('🔌 Subscribing to price updates...');
    setConnectionStatus('connecting');

    const channel = supabase.channel('price-updates', {
      config: {
        broadcast: { self: false },
        presence: { key: crypto.randomUUID() },
      },
    });

    channel
      .on('broadcast', { event: 'price' }, (payload: any) => {
        const { symbol, price, change_24h, timestamp, source } = payload.payload;
        
        if (symbol && price) {
          setPrices((prev) => {
            const newPrices = new Map(prev);
            newPrices.set(symbol, {
              symbol,
              price,
              change_24h: change_24h || 0,
              timestamp: timestamp || Date.now(),
              source: source || 'twelve_data',
            });
            return newPrices;
          });
          
          setLastUpdate(new Date());
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const userCount = Object.keys(state).length;
        logger.debug(`👥 Active users in price channel: ${userCount}`);
      })
      .subscribe(async (status: string) => {
        logger.debug(`📡 Price subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionStatus('connected');
          logger.debug('✅ Successfully subscribed to price updates');
          
          // Track presence
          await channel.track({
            online_at: new Date().toISOString(),
            user_id: (await supabase.auth.getUser()).data.user?.id || 'anonymous',
          });
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setConnectionStatus('disconnected');
          logger.error('❌ Failed to subscribe to price updates');
        } else if (status === 'TIMED_OUT') {
          setIsConnected(false);
          setConnectionStatus('disconnected');
          logger.error('⏱️ Price subscription timed out');
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount or when dependencies change
    return () => {
      if (channelRef.current) {
        logger.debug('🔌 Cleaning up price subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
      }
    };
  }, [isUserActive]);

  // Handle network reconnection
  useEffect(() => {
    const handleOnline = () => {
      logger.debug('🌐 Network back online - reconnecting...');
      if (isUserActive && !document.hidden) {
        setConnectionStatus('connecting');
      }
    };

    const handleOffline = () => {
      logger.debug('🌐 Network offline');
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

  return {
    prices,
    isConnected,
    lastUpdate,
    connectionStatus,
    isUserActive,
  };
};
