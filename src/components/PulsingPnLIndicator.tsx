import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PulsingPnLIndicatorProps {
  pnl: number;
  className?: string;
  showIcon?: boolean;
}

export const PulsingPnLIndicator: React.FC<PulsingPnLIndicatorProps> = ({ 
  pnl, 
  className = "",
  showIcon = false
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const [prevPnL, setPrevPnL] = useState(pnl);

  useEffect(() => {
    // Detect any change, even tiny ones (0.001 sensitivity)  
    const pnlDiff = Math.abs(pnl - prevPnL);
    if (pnlDiff >= 0.001 && !isNaN(pnl) && !isNaN(prevPnL)) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 400);
      setPrevPnL(pnl);
      return () => clearTimeout(timer);
    } else if (pnl !== prevPnL && !isNaN(pnl)) {
      // Update prevPnL even for non-pulsing changes
      setPrevPnL(pnl);
    }
  }, [pnl, prevPnL]);

  const isPositive = pnl >= 0;
  const displayPnL = isNaN(pnl) ? 0 : pnl;

  const colorClass = isPositive 
    ? 'text-green-600 dark:text-green-400' 
    : 'text-red-600 dark:text-red-400';

  const pulseClass = isPulsing 
    ? 'animate-[pulse_0.5s_ease-in-out] ring-2 ring-opacity-50 ' + 
      (isPositive ? 'ring-green-400' : 'ring-red-400') 
    : '';

  return (
    <div className={`inline-flex items-center gap-1 transition-all duration-200 rounded px-1 ${pulseClass} ${className}`}>
      {showIcon && (
        isPositive ? (
          <TrendingUp className={`h-3 w-3 ${isPulsing ? 'animate-pulse' : ''} ${colorClass}`} />
        ) : (
          <TrendingDown className={`h-3 w-3 ${isPulsing ? 'animate-pulse' : ''} ${colorClass}`} />
        )
      )}
      <span className={`text-sm font-medium ${colorClass}`}>
        {displayPnL >= 0 ? '+' : ''}${displayPnL.toFixed(2)}
      </span>
    </div>
  );
};