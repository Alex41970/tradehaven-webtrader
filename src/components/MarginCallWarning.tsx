import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarginCallWarningProps {
  equity: number;
  usedMargin: number;
  className?: string;
}

export const MarginCallWarning: React.FC<MarginCallWarningProps> = ({
  equity,
  usedMargin,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Calculate margin level: (Equity / Used Margin) × 100%
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 999;

  useEffect(() => {
    // Show warning when margin level is critical
    if (marginLevel <= 100 && marginLevel > 0) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [marginLevel]);

  if (!isVisible || marginLevel > 100) {
    return null;
  }

  // Stop-out imminent (50% or below)
  if (marginLevel <= 50) {
    return (
      <Alert
        variant="destructive"
        className={cn('border-trading-danger bg-trading-danger/10 animate-pulse', className)}
      >
        <XCircle className="h-5 w-5" />
        <AlertTitle className="text-lg font-bold">STOP-OUT IMMINENT</AlertTitle>
        <AlertDescription className="space-y-2">
          <p className="text-sm font-medium">
            Margin Level: <span className="text-trading-danger text-lg">{marginLevel.toFixed(1)}%</span>
          </p>
          <p className="text-sm">
            Your positions will be automatically closed if margin level reaches 50% or below.
            Add funds or close positions immediately to avoid forced liquidation.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  // Margin call warning (100% or below)
  return (
    <Alert
      variant="default"
      className={cn('border-trading-accent bg-trading-accent/10', className)}
    >
      <AlertTriangle className="h-5 w-5 text-trading-accent" />
      <AlertTitle className="text-lg font-bold text-trading-accent">MARGIN CALL WARNING</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm font-medium">
          Margin Level: <span className="text-trading-accent text-lg">{marginLevel.toFixed(1)}%</span>
        </p>
        <p className="text-sm">
          Your account equity is approaching the stop-out level. Consider adding funds or
          closing positions to reduce margin usage.
        </p>
        <div className="mt-2 text-xs space-y-1">
          <p>• Margin Call Level: 100%</p>
          <p>• Stop-Out Level: 50% (auto-close all positions)</p>
        </div>
      </AlertDescription>
    </Alert>
  );
};
