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

    console.log('🔄 Connection Manager: Activity transition detected', {
      from: prevState,
      to: currentState
    });

    // Handle specific transitions without page reload
    if (prevState.isCompletelyDisconnected && !currentState.isCompletelyDisconnected) {
      console.log('🔄 Connection Manager: Reconnecting after complete disconnection');
      handleReconnection();
    } else if (!prevState.isCompletelyDisconnected && currentState.isCompletelyDisconnected) {
      console.log('🔄 Connection Manager: Entering complete disconnection mode');
      handleDisconnection();
    } else if (prevState.isUserActive && !currentState.isUserActive) {
      console.log('🔄 Connection Manager: User became inactive - pausing connections');
      handleInactiveTransition();
    } else if (!prevState.isUserActive && currentState.isUserActive) {
      console.log('🔄 Connection Manager: User became active - resuming connections');
      handleActiveTransition();
    }

    lastActivityRef.current = currentState;
  }, [isUserActive, isCompletelyDisconnected]);

  const handleReconnection = () => {
    // Surgical reconnection without page reload
    console.log('🔄 Performing surgical reconnection...');
    
    // The ActivityAwareSubscriptionManager automatically handles this
    // No additional action needed - subscriptions will reactivate automatically
    
    // Optionally trigger a refresh of critical data
    window.dispatchEvent(new CustomEvent('activity-reconnection'));
  };

  const handleDisconnection = () => {
    console.log('🔄 Performing graceful disconnection...');
    
    // The ActivityAwareSubscriptionManager automatically handles this
    // Subscriptions are paused, saving real-time messages
    
    window.dispatchEvent(new CustomEvent('activity-disconnection'));
  };

  const handleInactiveTransition = () => {
    console.log('🔄 Transitioning to inactive mode...');
    
    // Subscriptions are automatically paused by ActivityAwareSubscriptionManager
    window.dispatchEvent(new CustomEvent('activity-inactive'));
  };

  const handleActiveTransition = () => {
    console.log('🔄 Transitioning to active mode...');
    
    // Subscriptions are automatically resumed by ActivityAwareSubscriptionManager
    window.dispatchEvent(new CustomEvent('activity-active'));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🔄 Connection Manager: Cleaning up...');
    };
  }, []);

  return {
    isManaged: true,
    subscriptionStatus: subscriptionManager.getSubscriptionStatus(),
  };
};