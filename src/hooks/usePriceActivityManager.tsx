import { useActivity } from '@/contexts/ActivityContext';
import { usePrices } from '@/contexts/PriceContext';
import { useActivityAwareConnectionManager } from './useActivityAwareConnectionManager';

export const usePriceActivityManager = () => {
  // Use the activity-aware connection manager for event dispatching
  const connectionManager = useActivityAwareConnectionManager();
  
  const { isUserActive, isCompletelyDisconnected } = useActivity();
  const { isConnected, connectionStatus } = usePrices();

  return {
    isUserActive,
    isCompletelyDisconnected,
    isConnected,
    connectionStatus,
    managedByConnectionManager: connectionManager.isManaged
  };
};
