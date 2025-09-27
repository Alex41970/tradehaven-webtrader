import { useEffect, useRef } from 'react';
import { useActivity } from '@/contexts/ActivityContext';
import { usePrices } from '@/contexts/PriceContext';
import { useActivityAwareConnectionManager } from './useActivityAwareConnectionManager';

export const usePriceActivityManager = () => {
  // Use the new activity-aware connection manager instead of page reloads
  const connectionManager = useActivityAwareConnectionManager();
  
  const { isUserActive, isCompletelyDisconnected } = useActivity();
  const { isConnected, connectionStatus } = usePrices();

  console.log('📊 Price Activity Manager: Using smart connection management (no more page reloads)');

  return {
    isUserActive,
    isCompletelyDisconnected,
    isConnected,
    connectionStatus,
    managedByConnectionManager: connectionManager.isManaged,
    subscriptionStatus: connectionManager.subscriptionStatus
  };
};