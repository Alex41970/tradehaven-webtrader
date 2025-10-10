/**
 * Phase 2: Proper Forex P&L Calculation
 * 
 * Correctly calculates profit/loss for forex trades accounting for:
 * - Contract size (standard lot = 100,000 units)
 * - Pip values (different for JPY pairs vs others)
 * - Quote currency considerations
 */

export interface ForexPnLParams {
  tradeType: 'BUY' | 'SELL';
  lotSize: number;
  openPrice: number;
  closePrice: number;
  leverage: number;
  quoteCurrency: string;
  contractSize?: number; // Default: 100,000 (standard lot)
}

export const calculateForexPnL = ({
  tradeType,
  lotSize,
  openPrice,
  closePrice,
  leverage,
  quoteCurrency,
  contractSize = 100000,
}: ForexPnLParams): number => {
  // Calculate price difference based on trade direction
  const priceDifference = tradeType === 'BUY'
    ? closePrice - openPrice
    : openPrice - closePrice;

  // Calculate total units traded
  const totalUnits = lotSize * contractSize;

  // Calculate P&L in quote currency
  // For forex: P&L = (price difference) × (total units)
  const pnl = priceDifference * totalUnits;

  return pnl;
};

export const calculateForexMargin = ({
  lotSize,
  price,
  leverage,
  contractSize = 100000,
}: {
  lotSize: number;
  price: number;
  leverage: number;
  contractSize?: number;
}): number => {
  // Margin = (Lot Size × Contract Size × Current Price) / Leverage
  const margin = (lotSize * contractSize * price) / leverage;
  return margin;
};

export const calculatePipValue = ({
  lotSize,
  quoteCurrency,
  contractSize = 100000,
}: {
  lotSize: number;
  quoteCurrency: string;
  contractSize?: number;
}): number => {
  // For most forex pairs: 1 pip = 0.0001
  // For JPY pairs: 1 pip = 0.01
  const pipSize = quoteCurrency.includes('JPY') ? 0.01 : 0.0001;
  
  // Pip value = lot size × contract size × pip size
  const pipValue = lotSize * contractSize * pipSize;
  
  return pipValue;
};

export const calculateRiskRewardRatio = ({
  currentPrice,
  stopLossPrice,
  takeProfitPrice,
}: {
  currentPrice: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
}): number | null => {
  if (!stopLossPrice || !takeProfitPrice) {
    return null;
  }

  const risk = Math.abs(currentPrice - stopLossPrice);
  const reward = Math.abs(takeProfitPrice - currentPrice);

  if (risk === 0) {
    return null;
  }

  return reward / risk;
};
