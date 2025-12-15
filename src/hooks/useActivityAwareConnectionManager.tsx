import { useEffect, useRef } from 'react';
import { useActivity } from '@/contexts/ActivityContext';

/**
 * Simplified connection lifecycle management hook
 * Dispatches events for activity state changes (no longer manages subscriptions)
 */
export const useActivityAwareConnectionManager = () => {
  const { isUserActive, isCompletelyDisconnected } = useActivity();
  const lastActivityRef = useRef({ isUserActive: true, isCompletelyDisconnected: false });

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

    // Dispatch events for activity state changes
    if (prevState.isCompletelyDisconnected && !currentState.isCompletelyDisconnected) {
      window.dispatchEvent(new CustomEvent('activity-reconnection'));
    } else if (!prevState.isCompletelyDisconnected && currentState.isCompletelyDisconnected) {
      window.dispatchEvent(new CustomEvent('activity-disconnection'));
    } else if (prevState.isUserActive && !currentState.isUserActive) {
      window.dispatchEvent(new CustomEvent('activity-inactive'));
    } else if (!prevState.isUserActive && currentState.isUserActive) {
      window.dispatchEvent(new CustomEvent('activity-active'));
    }

    lastActivityRef.current = currentState;
  }, [isUserActive, isCompletelyDisconnected]);

  return {
    isManaged: true,
  };
};
