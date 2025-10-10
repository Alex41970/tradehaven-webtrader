import React from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceAgeIndicatorProps {
  priceTimestamp: Date | string | null;
  className?: string;
}

export const PriceAgeIndicator: React.FC<PriceAgeIndicatorProps> = ({
  priceTimestamp,
  className,
}) => {
  if (!priceTimestamp) {
    return (
      <div className={cn('flex items-center gap-1 text-xs text-muted-foreground', className)}>
        <AlertCircle className="h-3 w-3" />
        <span>No price data</span>
      </div>
    );
  }

  const timestamp = typeof priceTimestamp === 'string' ? new Date(priceTimestamp) : priceTimestamp;
  const ageMs = Date.now() - timestamp.getTime();
  const ageSeconds = Math.floor(ageMs / 1000);

  // Determine freshness status
  const isFresh = ageMs < 3000; // Less than 3 seconds
  const isStale = ageMs >= 3000 && ageMs < 10000; // 3-10 seconds
  const isVeryStale = ageMs >= 10000; // More than 10 seconds

  // Format age display
  let ageDisplay: string;
  if (ageSeconds < 60) {
    ageDisplay = `${ageSeconds}s ago`;
  } else {
    const ageMinutes = Math.floor(ageSeconds / 60);
    ageDisplay = `${ageMinutes}m ago`;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-xs',
        isFresh && 'text-trading-success',
        isStale && 'text-trading-accent',
        isVeryStale && 'text-trading-danger',
        className
      )}
    >
      <Clock className="h-3 w-3" />
      <span>{ageDisplay}</span>
      {isVeryStale && (
        <AlertCircle className="h-3 w-3 animate-pulse" />
      )}
    </div>
  );
};
