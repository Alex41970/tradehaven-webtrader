import { useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface RateLimitConfig {
  maxActionsPerMinute: number;
  maxActionsPerHour: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxActionsPerMinute: 10,
  maxActionsPerHour: 100,
};

export const useTradingRateLimiter = (config: RateLimitConfig = DEFAULT_CONFIG) => {
  const minuteTimestamps = useRef<number[]>([]);
  const hourTimestamps = useRef<number[]>([]);

  const canPerformAction = useCallback((actionType: string): boolean => {
    const now = Date.now();

    // Clean old timestamps (older than 1 minute)
    minuteTimestamps.current = minuteTimestamps.current.filter(
      t => now - t < 60000
    );

    // Clean old timestamps (older than 1 hour)
    hourTimestamps.current = hourTimestamps.current.filter(
      t => now - t < 3600000
    );

    // Check minute limit
    if (minuteTimestamps.current.length >= config.maxActionsPerMinute) {
      toast.error(`Rate limit exceeded`, {
        description: `Maximum ${config.maxActionsPerMinute} ${actionType}s per minute. Please slow down.`,
      });
      return false;
    }

    // Check hour limit
    if (hourTimestamps.current.length >= config.maxActionsPerHour) {
      toast.error(`Rate limit exceeded`, {
        description: `Maximum ${config.maxActionsPerHour} ${actionType}s per hour. Please try again later.`,
      });
      return false;
    }

    // Record this action
    minuteTimestamps.current.push(now);
    hourTimestamps.current.push(now);

    return true;
  }, [config]);

  const getStats = useCallback(() => {
    const now = Date.now();
    const recentMinute = minuteTimestamps.current.filter(t => now - t < 60000).length;
    const recentHour = hourTimestamps.current.filter(t => now - t < 3600000).length;

    return {
      actionsLastMinute: recentMinute,
      actionsLastHour: recentHour,
      remainingMinute: config.maxActionsPerMinute - recentMinute,
      remainingHour: config.maxActionsPerHour - recentHour,
    };
  }, [config]);

  return {
    canPerformAction,
    getStats,
  };
};
