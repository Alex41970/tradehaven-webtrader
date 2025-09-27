import { useState, useEffect, useRef } from 'react';

interface PerformanceMetrics {
  messageCount: number;
  messagesPerSecond: number;
  totalMessages: number;
  connectionUptime: number;
  lastReset: Date;
}

export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    messageCount: 0,
    messagesPerSecond: 0,
    totalMessages: 0,
    connectionUptime: 0,
    lastReset: new Date()
  });

  const messageCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track WebSocket messages
  const trackMessage = () => {
    messageCountRef.current += 1;
  };

  // Update metrics every 10 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const uptime = Math.floor((now - startTimeRef.current) / 1000);
      const messagesPerSecond = messageCountRef.current / Math.max(uptime, 1);

      setMetrics(prev => ({
        messageCount: messageCountRef.current,
        messagesPerSecond: Number(messagesPerSecond.toFixed(2)),
        totalMessages: prev.totalMessages + messageCountRef.current,
        connectionUptime: uptime,
        lastReset: prev.lastReset
      }));

      // Reset counters for next interval
      messageCountRef.current = 0;
      startTimeRef.current = now;
    }, 10000); // Update every 10 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const resetMetrics = () => {
    messageCountRef.current = 0;
    startTimeRef.current = Date.now();
    setMetrics({
      messageCount: 0,
      messagesPerSecond: 0,
      totalMessages: 0,
      connectionUptime: 0,
      lastReset: new Date()
    });
  };

  return {
    metrics,
    trackMessage,
    resetMetrics
  };
};