interface Trade {
  trade_type: 'BUY' | 'SELL';
  amount: number;
  open_price: number;
  leverage?: number;
}

export const calculateRealTimePnL = (trade: Trade, currentPrice: number): number => {
  if (!currentPrice || isNaN(currentPrice) || !trade.open_price || isNaN(trade.open_price)) {
    return 0;
  }

  const amount = Number(trade.amount);
  const openPrice = Number(trade.open_price);
  const leverage = Number(trade.leverage) || 1;

  let pnl = 0;
  
  if (trade.trade_type === 'BUY') {
    // For BUY trades: profit when current price > open price
    pnl = amount * (currentPrice - openPrice) * leverage;
  } else {
    // For SELL trades: profit when current price < open price  
    pnl = amount * (openPrice - currentPrice) * leverage;
  }

  return pnl;
};

export const formatPnL = (pnl: number): string => {
  return `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
};