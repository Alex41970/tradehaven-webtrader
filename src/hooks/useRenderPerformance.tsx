import { useState, useEffect, useRef } from 'react';

interface RenderMetrics {
  renderCount: number;
  averageRenderTime: number;
  memoryUsage: number;
  componentUpdates: Record<string, number>;
  lastMeasurement: Date;
}

/**
 * Hook to monitor React render performance metrics
 */
export const useRenderPerformance = (componentName: string = 'Unknown') => {
  const [metrics, setMetrics] = useState<RenderMetrics>({
    renderCount: 0,
    averageRenderTime: 0,
    memoryUsage: 0,
    componentUpdates: {},
    lastMeasurement: new Date()
  });

  const renderStartTime = useRef<number>(0);
  const renderTimes = useRef<number[]>([]);
  const componentUpdateCounts = useRef<Record<string, number>>({});

  // Track render start
  const startRenderTracking = () => {
    renderStartTime.current = performance.now();
  };

  // Track render end
  const endRenderTracking = () => {
    const renderTime = performance.now() - renderStartTime.current;
    renderTimes.current.push(renderTime);
    
    // Keep only last 10 render times for average calculation
    if (renderTimes.current.length > 10) {
      renderTimes.current.shift();
    }

    // Update component update count
    componentUpdateCounts.current[componentName] = 
      (componentUpdateCounts.current[componentName] || 0) + 1;
  };

  // Calculate metrics
  useEffect(() => {
    const interval = setInterval(() => {
      const averageRenderTime = renderTimes.current.length > 0
        ? renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length
        : 0;

      // Get memory usage if available
      const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;

      setMetrics({
        renderCount: renderTimes.current.length,
        averageRenderTime: Math.round(averageRenderTime * 100) / 100,
        memoryUsage: Math.round(memoryUsage / 1024 / 1024 * 100) / 100, // MB
        componentUpdates: { ...componentUpdateCounts.current },
        lastMeasurement: new Date()
      });
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-track renders in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      startRenderTracking();
      
      return () => {
        endRenderTracking();
      };
    }
  });

  return {
    metrics,
    startRenderTracking,
    endRenderTracking,
    resetMetrics: () => {
      renderTimes.current = [];
      componentUpdateCounts.current = {};
    }
  };
};
