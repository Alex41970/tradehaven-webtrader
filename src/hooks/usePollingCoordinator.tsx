import { useRef, useCallback, useEffect } from 'react';

interface PollingConfig {
  id: string;
  interval: number;
  callback: () => Promise<void> | void;
  priority: 'high' | 'medium' | 'low';
  conditions?: () => boolean;
}

/**
 * Coordinates multiple polling operations to prevent overlap and optimize resource usage
 */
export const usePollingCoordinator = () => {
  const activePollers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const configMap = useRef<Map<string, PollingConfig>>(new Map());
  const lastExecutionMap = useRef<Map<string, number>>(new Map());

  // Register a poller with the coordinator
  const registerPoller = useCallback((config: PollingConfig) => {
    configMap.current.set(config.id, config);
    
    // Start the poller
    const startPoller = () => {
      // Check conditions before starting
      if (config.conditions && !config.conditions()) {
        // Re-check conditions every 5 seconds
        const timeoutId = setTimeout(startPoller, 5000);
        activePollers.current.set(config.id, timeoutId);
        return;
      }

      const execute = async () => {
        const now = Date.now();
        const lastExecution = lastExecutionMap.current.get(config.id) || 0;
        
        // Prevent too frequent executions (minimum 1 second between calls)
        if (now - lastExecution < 1000) {
          return;
        }

        try {
          await config.callback();
          lastExecutionMap.current.set(config.id, now);
        } catch (error) {
          console.error(`Polling error for ${config.id}:`, error);
        }
      };

      // Execute immediately, then set up interval
      execute();
      
      const intervalId = setInterval(execute, config.interval);
      activePollers.current.set(config.id, intervalId);
    };

    startPoller();
    console.log(`📊 Registered poller: ${config.id} (${config.interval}ms, ${config.priority} priority)`);
  }, []);

  // Unregister a poller
  const unregisterPoller = useCallback((id: string) => {
    const intervalId = activePollers.current.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      activePollers.current.delete(id);
    }
    configMap.current.delete(id);
    lastExecutionMap.current.delete(id);
    console.log(`📊 Unregistered poller: ${id}`);
  }, []);

  // Update poller configuration (useful for dynamic intervals)
  const updatePoller = useCallback((id: string, updates: Partial<PollingConfig>) => {
    const existingConfig = configMap.current.get(id);
    if (existingConfig) {
      const newConfig = { ...existingConfig, ...updates };
      unregisterPoller(id);
      registerPoller(newConfig);
    }
  }, [registerPoller, unregisterPoller]);

  // Get status of all pollers
  const getStatus = useCallback(() => {
    return Array.from(configMap.current.entries()).map(([id, config]) => ({
      id,
      interval: config.interval,
      priority: config.priority,
      isActive: activePollers.current.has(id),
      lastExecution: lastExecutionMap.current.get(id) || 0
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activePollers.current.forEach((intervalId) => {
        clearInterval(intervalId);
      });
      activePollers.current.clear();
      configMap.current.clear();
      lastExecutionMap.current.clear();
    };
  }, []);

  return {
    registerPoller,
    unregisterPoller,
    updatePoller,
    getStatus
  };
};