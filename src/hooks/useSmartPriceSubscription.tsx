import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
  source?: string;
  mode?: 'websocket' | 'polling' | 'offline';
}

interface SmartPriceSubscriptionResult {
  prices: Map<string, PriceUpdate>;
  isConnected: boolean;
  lastUpdate: Date | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'paused';
  isUserActive: boolean;
  connectionMode: 'websocket' | 'polling' | 'offline';
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
  const [connectionMode, setConnectionMode] = useState<'websocket' | 'polling' | 'offline'>('offline');

  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastWakeAttemptRef = useRef<number>(0);
  
  const activityTimeoutMs = 3 * 60 * 1000; // 3 minutes
  const staleThresholdMs = 30000; // 30 seconds (increased from 15s - heartbeat runs every 2s)
  const checkIntervalMs = 30000; // 30 seconds (increased from 10s - reduces overhead)
  const wakeCooldownMs = 60000; // 60 seconds (increased from 30s)

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

  // Boot relay on mount + watchdog for stale prices
  useEffect(() => {
    if (!isUserActive || document.hidden) {
      // Clear watchdog when inactive
      if (watchdogTimerRef.current) {
        clearInterval(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      return;
    }

    // Immediately wake the relay on first mount
    const wakeRelay = async () => {
      const now = Date.now();
      if (now - lastWakeAttemptRef.current < wakeCooldownMs) {
        return;
      }

      lastWakeAttemptRef.current = now;
      logger.debug('🔔 Waking websocket-price-relay...');
      
      try {
        const { data, error } = await supabase.functions.invoke('websocket-price-relay', {
          body: { action: 'ping' }
        });
        
        if (error) {
          logger.error('❌ Failed to wake relay:', error);
        } else {
          logger.debug('✅ Relay woken:', data);
        }
      } catch (err) {
        logger.error('❌ Exception waking relay:', err);
      }
    };

    // Wake relay immediately
    wakeRelay();

    // Start watchdog to detect stale prices
    watchdogTimerRef.current = setInterval(() => {
      if (!isUserActive || document.hidden) return;

      const now = Date.now();
      const lastUpdateTime = lastUpdate?.getTime() || 0;
      const ageMs = now - lastUpdateTime;

      if (!lastUpdate || ageMs > staleThresholdMs) {
        logger.debug(`⚠️ Stale price detected (age: ${Math.floor(ageMs / 1000)}s), attempting wake...`);
        wakeRelay();
      }
    }, checkIntervalMs);

    return () => {
      if (watchdogTimerRef.current) {
        clearInterval(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
    };
  }, [isUserActive, lastUpdate]);

  // Manage presence tracking on the relay's presence channel
  useEffect(() => {
    if (!isUserActive || document.hidden) {
      // Untrack presence when inactive or hidden
      if (presenceChannelRef.current) {
        logger.debug('👋 Leaving price-relay-presence channel (inactive/hidden)');
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      return;
    }

    // Join presence channel when active and visible
    logger.debug('👋 Joining price-relay-presence channel...');
    
    const presenceChannel = supabase.channel('price-relay-presence', {
      config: {
        presence: { key: crypto.randomUUID() },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const userCount = Object.keys(state).length;
        logger.debug(`👥 Active clients in presence channel: ${userCount}`);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          // Track presence to signal the relay we're active
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            user_id: (await supabase.auth.getUser()).data.user?.id || 'anonymous',
          });
          logger.debug('✅ Presence tracked on price-relay-presence');
        }
      });

    presenceChannelRef.current = presenceChannel;

    return () => {
      if (presenceChannelRef.current) {
        logger.debug('🔌 Cleaning up presence channel');
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [isUserActive]);

  // Manage Supabase Realtime subscription for price updates
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
      },
    });

    channel
      .on('broadcast', { event: 'price' }, (payload: any) => {
        const { symbol, price, change_24h, timestamp, source, mode } = payload.payload;
        
        if (symbol && price) {
          setPrices((prev) => {
            const newPrices = new Map(prev);
            newPrices.set(symbol, {
              symbol,
              price,
              change_24h: change_24h || 0,
              timestamp: timestamp || Date.now(),
              source: source || 'twelve_data',
              mode: mode || 'websocket',
            });
            return newPrices;
          });
          
          setLastUpdate(new Date());
          
          // Update connection mode from price update
          if (mode) {
            setConnectionMode(mode);
          }
        }
      })
      .on('broadcast', { event: 'connection_mode' }, (payload: any) => {
        // Handle connection mode updates
        const { mode } = payload.payload;
        if (mode) {
          logger.debug(`📡 Connection mode updated: ${mode}`);
          setConnectionMode(mode);
        }
      })
      .subscribe(async (status: string) => {
        logger.debug(`📡 Price subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionStatus('connected');
          logger.debug('✅ Successfully subscribed to price updates');
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
    connectionMode,
  };
};
