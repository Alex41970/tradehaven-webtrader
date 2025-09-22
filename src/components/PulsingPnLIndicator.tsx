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
    ? 'text-trading-success' 
    : 'text-trading-danger';

  const pulseClass = isPulsing 
    ? 'animate-bounce-gentle ring-2 ring-opacity-60 shadow-lg ' + 
      (isPositive ? 'ring-trading-success/50 bg-trading-success/5' : 'ring-trading-danger/50 bg-trading-danger/5') 
    : '';

  return (
    <div className={`inline-flex items-center gap-1 transition-all duration-300 rounded-md px-2 py-1 ${pulseClass} ${className}`}>
      {showIcon && (
        isPositive ? (
          <TrendingUp className={`h-3 w-3 ${isPulsing ? 'animate-bounce-gentle' : ''} ${colorClass} drop-shadow-sm`} />
        ) : (
          <TrendingDown className={`h-3 w-3 ${isPulsing ? 'animate-bounce-gentle' : ''} ${colorClass} drop-shadow-sm`} />
        )
      )}
      <span className={`text-sm font-semibold ${colorClass} drop-shadow-sm`}>
        {displayPnL >= 0 ? '+' : ''}${displayPnL.toFixed(2)}
      </span>
    </div>
  );
};