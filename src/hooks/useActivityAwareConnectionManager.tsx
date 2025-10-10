import { useEffect, useRef } from 'react';
import { useActivity } from '@/contexts/ActivityContext';
import { getActivityAwareSubscriptionManager } from '@/services/ActivityAwareSubscriptionManager';
import { supabase } from '@/integrations/supabase/client';

/**
 * Enhanced connection lifecycle management hook that replaces the page reload mechanism
 * Provides smart reconnection logic based on user activity states
 */
export const useActivityAwareConnectionManager = () => {
  const { isUserActive, isCompletelyDisconnected } = useActivity();
  const lastActivityRef = useRef({ isUserActive: true, isCompletelyDisconnected: false });
  const subscriptionManager = getActivityAwareSubscriptionManager(supabase);

  useEffect(() => {
    const prevState = lastActivityRef.current;
    const currentState = { isUserActive, isCompletelyDisconnected };

    // Only handle transitions, not initial states
    if (
      prevState.isUserActive === currentState.isUserActive &&
      prevState.isCompletelyDisconnected === currentState.isCompletelyDisconnected
    ) {
      return;
    }

    // Handle specific transitions without page reload
    if (prevState.isCompletelyDisconnected && !currentState.isCompletelyDisconnected) {
      handleReconnection();
    } else if (!prevState.isCompletelyDisconnected && currentState.isCompletelyDisconnected) {
      handleDisconnection();
    } else if (prevState.isUserActive && !currentState.isUserActive) {
      handleInactiveTransition();
    } else if (!prevState.isUserActive && currentState.isUserActive) {
      handleActiveTransition();
    }

    lastActivityRef.current = currentState;
  }, [isUserActive, isCompletelyDisconnected]);

  const handleReconnection = () => {
    // Surgical reconnection without page reload
    // The ActivityAwareSubscriptionManager automatically handles this
    window.dispatchEvent(new CustomEvent('activity-reconnection'));
  };

  const handleDisconnection = () => {
    // The ActivityAwareSubscriptionManager automatically handles this
    window.dispatchEvent(new CustomEvent('activity-disconnection'));
  };

  const handleInactiveTransition = () => {
    // Subscriptions are automatically paused by ActivityAwareSubscriptionManager
    window.dispatchEvent(new CustomEvent('activity-inactive'));
  };

  const handleActiveTransition = () => {
    // Subscriptions are automatically resumed by ActivityAwareSubscriptionManager
    window.dispatchEvent(new CustomEvent('activity-active'));
  };

  return {
    isManaged: true,
    subscriptionStatus: subscriptionManager.getSubscriptionStatus(),
  };
};