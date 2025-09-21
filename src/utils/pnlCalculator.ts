interface Trade {
  trade_type: 'BUY' | 'SELL';
  amount: number;
  open_price: number;
  leverage?: number;
  contract_size?: number;
}

export const calculateRealTimePnL = (trade: Trade, currentPrice: number, contractSize: number = 1): number => {
  const amount = Number(trade.amount);
  const openPrice = Number(trade.open_price);
  const leverage = Number(trade.leverage) || 1;
  const current = Number(currentPrice);

  if (!isFinite(amount) || !isFinite(openPrice) || !isFinite(current) || openPrice <= 0 || current <= 0) {
    return 0;
  }

  // Use contract_size for forex calculations (default 1 for other assets)
  const effectiveContractSize = contractSize || trade.contract_size || 1;
  let pnl = 0;
  
  if (trade.trade_type === 'BUY') {
    // For BUY trades: profit when current price > open price
    pnl = amount * (current - openPrice) * leverage * effectiveContractSize;
  } else {
    // For SELL trades: profit when current price < open price  
    pnl = amount * (openPrice - current) * leverage * effectiveContractSize;
  }

  return pnl;
};

export const formatPnL = (pnl: number): string => {
  return `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
};