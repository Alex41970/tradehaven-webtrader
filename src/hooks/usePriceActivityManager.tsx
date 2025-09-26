import { useEffect, useRef } from 'react';
import { useActivity } from '@/contexts/ActivityContext';
import { usePrices } from '@/contexts/PriceContext';

export const usePriceActivityManager = () => {
  const { isUserActive } = useActivity();
  const { isConnected, connectionStatus } = usePrices();
  const wasUserActiveRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const wasActive = wasUserActiveRef.current;
    wasUserActiveRef.current = isUserActive;

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
  }, [isUserActive, connectionStatus, isConnected]);

  return {
    isUserActive,
    connectionStatus,
    isConnected
  };
};