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

  const registerPoller = useCallback((config: PollingConfig) => {
    configMap.current.set(config.id, config);
    
    const startPoller = () => {
      if (config.conditions && !config.conditions()) {
        const timeoutId = setTimeout(startPoller, 5000);
        activePollers.current.set(config.id, timeoutId);
        return;
      }

      const execute = async () => {
        const now = Date.now();
        const lastExecution = lastExecutionMap.current.get(config.id) || 0;
        
        if (now - lastExecution < 1000) {
          return;
        }

        try {
          await config.callback();
          lastExecutionMap.current.set(config.id, now);
        } catch {
          // Silent fail
        }
      };

      execute();
      
      const intervalId = setInterval(execute, config.interval);
      activePollers.current.set(config.id, intervalId);
    };

    startPoller();
  }, []);

  const unregisterPoller = useCallback((id: string) => {
    const intervalId = activePollers.current.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      activePollers.current.delete(id);
    }
    configMap.current.delete(id);
    lastExecutionMap.current.delete(id);
  }, []);

  const updatePoller = useCallback((id: string, updates: Partial<PollingConfig>) => {
    const existingConfig = configMap.current.get(id);
    if (existingConfig) {
      const newConfig = { ...existingConfig, ...updates };
      unregisterPoller(id);
      registerPoller(newConfig);
    }
  }, [registerPoller, unregisterPoller]);

  const getStatus = useCallback(() => {
    return Array.from(configMap.current.entries()).map(([id, config]) => ({
      id,
      interval: config.interval,
      priority: config.priority,
      isActive: activePollers.current.has(id),
      lastExecution: lastExecutionMap.current.get(id) || 0
    }));
  }, []);

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
