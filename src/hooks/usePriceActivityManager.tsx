import { useEffect, useRef } from 'react';
import { useActivity } from '@/contexts/ActivityContext';
import { usePrices } from '@/contexts/PriceContext';

export const usePriceActivityManager = () => {
  const { isUserActive, isCompletelyDisconnected } = useActivity();
  const { isConnected, connectionStatus } = usePrices();
  const wasUserActiveRef = useRef(true);
  const wasDisconnectedRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const wasActive = wasUserActiveRef.current;
    const wasDisconnected = wasDisconnectedRef.current;
    
    wasUserActiveRef.current = isUserActive;
    wasDisconnectedRef.current = isCompletelyDisconnected;

    // Handle return from complete disconnection
    if (!isCompletelyDisconnected && wasDisconnected) {
      console.log('🔄 Price Activity Manager: Returning from complete disconnection, reloading page');
      setTimeout(() => {
        window.location.reload();
      }, 100);
      return;
    }

    // Handle complete disconnection
    if (isCompletelyDisconnected && !wasDisconnected) {
      console.log('🔌 Price Activity Manager: Complete disconnection triggered');
      
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Force page reload to completely disconnect all services
      setTimeout(() => {
        window.location.reload();
      }, 100);
      return;
    }

    // Skip activity management if completely disconnected
    if (isCompletelyDisconnected) {
      return;
    }

    // Normal activity management (unchanged)
    if (isUserActive && !wasActive && connectionStatus === 'paused') {
      // User became active - trigger reconnection after a short delay
      console.log('🔄 Price Activity Manager: User became active, requesting reconnection');
      
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Trigger page reload to reinitialize connections with user active
      reconnectTimeoutRef.current = setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } else if (!isUserActive && wasActive && isConnected) {
      // User became inactive - trigger pause
      console.log('⏸️ Price Activity Manager: User became inactive, triggering pause');
      
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Force page reload to properly pause connections
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isUserActive, isCompletelyDisconnected, connectionStatus, isConnected]);

  return {
    isUserActive,
    isCompletelyDisconnected,
    connectionStatus,
    isConnected
  };
};