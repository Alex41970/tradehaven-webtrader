import { useAuth } from "./useAuth";
import { useRealTimeTrading } from './useRealTimeTrading';
import { useRealTimePrices } from './useRealTimePrices';
import { calculateRealTimePnL } from '@/utils/pnlCalculator';

export interface Trade {
  id: string;
  user_id: string;
  asset_id: string;
  symbol: string;
  trade_type: 'BUY' | 'SELL';
  amount: number;
  leverage: number;
  open_price: number;
  close_price?: number;
  current_price?: number;
  pnl: number;
  margin_used: number;
  status: 'open' | 'closed';
  trade_source: 'bot' | 'user';
  opened_at: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
}

export const useTrades = () => {
  const { user } = useAuth();
  const { 
    trades, 
    loading,
    openTrades,
    closedTrades,
    botTrades,
    userTrades,
    openBotTrades,
    openUserTrades,
    closedBotTrades,
    closedUserTrades,
    openTrade: realtimeOpenTrade,
    closeTrade: realtimeCloseTrade
  } = useRealTimeTrading();
  
  const { getUpdatedAssets } = useRealTimePrices();

  // Legacy fetch function (no longer used with WebSocket)
  const fetchTrades = async () => {
    console.log('fetchTrades called - now using real-time WebSocket');
  };

  const openTrade = async (
    assetId: string,
    symbol: string,
    tradeType: 'BUY' | 'SELL',
    amount: number,
    leverage: number,
    openPrice: number,
    marginUsed: number
  ) => {
    if (!user) return null;

    try {
      console.log('Opening trade via WebSocket:', { assetId, symbol, tradeType, amount, leverage, openPrice, marginUsed });
      
      await realtimeOpenTrade(assetId, symbol, tradeType, amount, leverage, openPrice, marginUsed);
      
      // Return a mock trade object for compatibility
      return {
        id: 'pending',
        user_id: user.id,
        asset_id: assetId,
        symbol,
        trade_type: tradeType,
        amount,
        leverage,
        open_price: openPrice,
        current_price: openPrice,
        margin_used: marginUsed,
        status: 'open' as const,
        trade_source: 'user' as const,
        pnl: 0,
        opened_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error opening trade via WebSocket:', error);
      throw error;
    }
  };

  const closeTrade = async (tradeId: string, closePrice: number) => {
    console.log('Closing trade via WebSocket:', tradeId, 'at price:', closePrice);
    
    try {
      await realtimeCloseTrade(tradeId, closePrice);
      return true;
    } catch (error) {
      console.error('Error closing trade via WebSocket:', error);
      throw error;
    }
  };

  // Real-time P&L updates are now handled by the WebSocket system
  const updateTradePnL = async (tradeId: string, currentPrice: number) => {
    console.log('updateTradePnL called - now handled by real-time WebSocket system');
  };

  // Derived data is now provided by useRealTimeTrading

  return {
    trades,
    openTrades,
    closedTrades,
    botTrades,
    userTrades,
    openBotTrades,
    openUserTrades,
    closedBotTrades,
    closedUserTrades,
    loading,
    refetch: fetchTrades,
    openTrade,
    closeTrade,
    updateTradePnL,
    recalculateMargins: async () => true, // No longer needed with real-time system
  };
};