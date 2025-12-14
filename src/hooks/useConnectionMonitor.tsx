import { useState, useEffect } from 'react';

interface NetworkState {
  isOnline: boolean;
  connectionType: string;
  downlink?: number;
  effectiveType?: string;
}

export const useConnectionMonitor = () => {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isOnline: navigator.onLine,
    connectionType: 'unknown'
  });

  useEffect(() => {
    const updateNetworkState = () => {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;

      setNetworkState({
        isOnline: navigator.onLine,
        connectionType: connection?.type || 'unknown',
        downlink: connection?.downlink,
        effectiveType: connection?.effectiveType
      });
    };

    const handleOnline = () => {
      updateNetworkState();
    };

    const handleOffline = () => {
      updateNetworkState();
    };

    const handleConnectionChange = () => {
      updateNetworkState();
    };

    // Initial state
    updateNetworkState();

    // Event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  return {
    ...networkState,
    isSlowConnection: networkState.effectiveType === '2g' || networkState.effectiveType === 'slow-2g'
  };
};