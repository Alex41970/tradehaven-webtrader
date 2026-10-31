interface Trade {
  trade_type: 'BUY' | 'SELL' | string;
  amount: number;
  open_price: number;
  leverage?: number;
  symbol?: string;
}

// Lot size per symbol (e.g. 1 lot EURUSD = 100,000 units, 1 lot gold = 100 oz).
// Filled from the assets list when prices load; must match the database's calc_trade_pnl.
const contractSizes = new Map<string, number>();

export const setContractSizes = (entries: { symbol: string; contract_size: number | null }[]) => {
  entries.forEach((e) => contractSizes.set(e.symbol, Number(e.contract_size) || 1));
};

export const getContractSize = (symbol?: string): number => (symbol && contractSizes.get(symbol)) || 1;

/**
 * P&L = price difference × lots × contract size.
 * Leverage only reduces the margin needed; it does not multiply P&L.
 */
export const calculateRealTimePnL = (trade: Trade, currentPrice: number, contractSize?: number): number => {
  const lots = Number(trade.amount);
  const openPrice = Number(trade.open_price);
  const current = Number(currentPrice);
  const size = contractSize ?? getContractSize(trade.symbol);

  if (!isFinite(lots) || !isFinite(openPrice) || !isFinite(current) || openPrice <= 0 || current <= 0) {
    return 0;
  }

  const diff = String(trade.trade_type).toUpperCase() === 'BUY' ? current - openPrice : openPrice - current;
  return diff * lots * size;
};

/** Margin = lots × contract size × price ÷ leverage */
export const calculateMargin = (lots: number, price: number, leverage: number, contractSize: number): number => {
  if (!isFinite(lots) || !isFinite(price) || lots <= 0 || price <= 0) return 0;
  return (lots * (contractSize || 1) * price) / Math.max(leverage || 1, 1);
};

export const formatPnL = (pnl: number): string => {
  return `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
};
