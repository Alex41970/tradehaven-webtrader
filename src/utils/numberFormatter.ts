export interface NumberFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  showFullInTooltip?: boolean;
}

// Format numbers with K, M, B abbreviations for large values
export const formatLargeNumber = (
  num: number, 
  options: NumberFormatOptions = {}
): { display: string; full: string; isAbbreviated: boolean } => {
  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;
  
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  // Full formatted number for tooltips
  const fullFormatted = `${sign}$${absNum.toLocaleString('en-US', { 
    minimumFractionDigits, 
    maximumFractionDigits 
  })}`;
  
  // If number is less than 1000, show as is
  if (absNum < 1000) {
    return {
      display: fullFormatted,
      full: fullFormatted,
      isAbbreviated: false
    };
  }
  
  // If number is less than 100,000, show with K but not abbreviated
  if (absNum < 100000) {
    return {
      display: fullFormatted,
      full: fullFormatted,
      isAbbreviated: false
    };
  }
  
  let abbreviated: string;
  let isAbbreviated = true;
  
  if (absNum >= 1e9) {
    // Billions
    abbreviated = `${sign}$${(absNum / 1e9).toFixed(2)}B`;
  } else if (absNum >= 1e6) {
    // Millions
    abbreviated = `${sign}$${(absNum / 1e6).toFixed(2)}M`;
  } else if (absNum >= 1e3) {
    // Thousands
    abbreviated = `${sign}$${(absNum / 1e3).toFixed(1)}K`;
  } else {
    abbreviated = fullFormatted;
    isAbbreviated = false;
  }
  
  return {
    display: abbreviated,
    full: fullFormatted,
    isAbbreviated
  };
};

// Get responsive text size classes based on number length
export const getResponsiveTextSize = (num: number, baseSize: string = 'text-xl'): string => {
  const numStr = Math.abs(num).toString();
  const length = numStr.length;
  
  // Adjust text size based on number length
  if (length >= 10) return baseSize.replace(/text-\w+/, 'text-lg');
  if (length >= 8) return baseSize.replace(/text-\w+/, 'text-xl');
  if (length >= 6) return baseSize.replace(/text-\w+/, 'text-2xl');
  
  return baseSize;
};

// Format percentage with proper handling
export const formatPercentage = (value: number, decimals: number = 1): string => {
  if (!isFinite(value)) return '0.0%';
  return `${value.toFixed(decimals)}%`;
};

// Format P&L with proper color indication
export const formatPnL = (
  pnl: number, 
  options: NumberFormatOptions = {}
): { display: string; full: string; isAbbreviated: boolean; colorClass: string } => {
  const formatted = formatLargeNumber(pnl, options);
  
  const colorClass = pnl >= 0 ? 'text-trading-success' : 'text-trading-danger';
  
  return {
    ...formatted,
    colorClass
  };
};