interface Trade {
  trade_type: 'BUY' | 'SELL';
  amount: number;
  open_price: number;
  leverage?: number;
}

/**
 * Calculate P&L for crypto trades (simplified - no contract size needed)
 */
export const calculateRealTimePnL = (trade: Trade, currentPrice: number): number => {
  const amount = Number(trade.amount);
  const openPrice = Number(trade.open_price);
  const leverage = Number(trade.leverage) || 1;
  const current = Number(currentPrice);

  if (!isFinite(amount) || !isFinite(openPrice) || !isFinite(current) || openPrice <= 0 || current <= 0) {
    return 0;
  }

  let pnl = 0;
  
  if (trade.trade_type === 'BUY') {
    // For BUY trades: profit when current price > open price
    pnl = amount * (current - openPrice) * leverage;
  } else {
    // For SELL trades: profit when current price < open price  
    pnl = amount * (openPrice - current) * leverage;
  }

  return pnl;
};

export const formatPnL = (pnl: number): string => {
  return `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
};
