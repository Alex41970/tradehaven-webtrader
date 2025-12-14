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
 * Uses presence tracking to signal the relay that users are online
 * The relay handles all coordination via database locks
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

  // Manage presence tracking - this is how we signal the relay
  useEffect(() => {
    if (!isUserActive || document.hidden) {
      if (presenceChannelRef.current) {
        logger.debug('👋 Leaving presence channel');
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      return;
    }

    logger.debug('👋 Joining presence channel');
    
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
        }
      });

    presenceChannelRef.current = presenceChannel;

    return () => {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [isUserActive]);

  // Manage price updates subscription
  useEffect(() => {
    if (!isUserActive || document.hidden) {
      if (channelRef.current) {
        logger.debug('🔌 Unsubscribing from prices');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
        setConnectionStatus('paused');
      }
      return;
    }

    logger.debug('🔌 Subscribing to prices');
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
              source: source || 'unknown',
              mode: mode || 'websocket',
            });
            return newPrices;
          });
          
          setLastUpdate(new Date());
          
          if (mode) {
            setConnectionMode(mode);
          }
        }
      })
      .on('broadcast', { event: 'connection_mode' }, (payload: any) => {
        const { mode } = payload.payload;
        if (mode) {
          logger.debug(`📡 Mode: ${mode}`);
          setConnectionMode(mode);
        }
      })
      .subscribe(async (status: string) => {
        logger.debug(`📡 Status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
          setConnectionStatus('disconnected');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
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

  // Keep edge function alive with periodic pings
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

    // Keep alive every 45 seconds (before 60s timeout)
    const interval = setInterval(keepAlive, 45000);

    return () => clearInterval(interval);
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