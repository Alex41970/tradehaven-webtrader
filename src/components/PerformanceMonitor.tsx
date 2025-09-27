import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Zap, Clock, BarChart3 } from 'lucide-react';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

export const PerformanceMonitor: React.FC = () => {
  const { metrics } = usePerformanceMonitor();

  const getMessageRateStatus = (rate: number) => {
    if (rate > 10) return { variant: 'destructive' as const, label: 'HIGH' };
    if (rate > 5) return { variant: 'default' as const, label: 'MEDIUM' };
    return { variant: 'secondary' as const, label: 'LOW' };
  };

  const rateStatus = getMessageRateStatus(metrics.messagesPerSecond);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          Real-time Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-3 w-3 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Msg/sec</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">{metrics.messagesPerSecond}</span>
                <Badge variant={rateStatus.variant} className="text-xs px-1 py-0">
                  {rateStatus.label}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3 w-3 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="text-sm font-medium">{metrics.totalMessages.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Uptime</span>
            <span className="text-sm font-medium">
              {Math.floor(metrics.connectionUptime / 60)}m {metrics.connectionUptime % 60}s
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};