import { useEffect, useState, useCallback } from 'react';
import { tradingWebSocket, TradingWebSocketMessage } from '@/services/TradingWebSocketService';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface RealTimeUserProfile {
  id: string;
  user_id: string;
  email?: string;
  first_name?: string;
  surname?: string;
  phone_number?: string;
  balance: number;
  equity: number;
  used_margin: number;
  available_margin: number;
  created_at: string;
  updated_at: string;
}

export interface RealTimeTrade {
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

export const useRealTimeTrading = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [profile, setProfile] = useState<RealTimeUserProfile | null>(null);
  const [trades, setTrades] = useState<RealTimeTrade[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Setup WebSocket event handlers
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const handleAuthSuccess = (message: TradingWebSocketMessage) => {
      console.log('Real-time trading authenticated');
      setIsConnected(true);
      setLoading(false);
      
      // Set initial data from authentication response
      if (message.profile) {
        setProfile(message.profile);
      }
      if (message.trades) {
        setTrades(message.trades);
      }
      
      toast({
        title: "Connected",
        description: "Real-time trading updates active",
        duration: 2000,
      });
    };

    const handleMarginUpdate = (message: TradingWebSocketMessage) => {
      console.log('Margins updated via real-time:', message.data);
      
      // Update profile with new margin data
      if (message.data) {
        setProfile(prev => prev ? {
          ...prev,
          balance: message.data.balance,
          used_margin: message.data.usedMargin,
          available_margin: message.data.availableMargin,
          equity: message.data.equity
        } : null);
      }
    };

    const handleAuthError = (message: TradingWebSocketMessage) => {
      console.error('Real-time trading auth error:', message.message);
      setIsConnected(false);
      setLoading(false);
      
      toast({
        title: "Connection Error",
        description: "Failed to connect to real-time trading",
        variant: "destructive",
      });
    };

    const handleTradeOpened = (message: TradingWebSocketMessage) => {
      console.log('Trade opened via real-time:', message.trade);
      
      // Update trades
      if (message.trades) {
        setTrades(message.trades);
      }
      
      // Update profile
      if (message.profile) {
        setProfile(message.profile);
      }
      
      toast({
        title: "Trade Opened",
        description: `${message.trade.trade_type} ${message.trade.symbol}`,
      });
    };

    const handleTradeClosed = (message: TradingWebSocketMessage) => {
      console.log('Trade closed via real-time:', message.trade);
      
      // Update trades
      if (message.trades) {
        setTrades(message.trades);
      }
      
      // Update profile
      if (message.profile) {
        setProfile(message.profile);
      }
      
      const pnl = message.trade.pnl || 0;
      toast({
        title: "Trade Closed",
        description: `P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
        variant: pnl >= 0 ? "default" : "destructive",
      });
    };

    const handleTradeError = (message: TradingWebSocketMessage) => {
      console.error('Trade error via real-time:', message.message);
      
      toast({
        title: "Trade Error",
        description: message.message || "Trade operation failed",
        variant: "destructive",
      });
    };

    const handleDisconnect = () => {
      console.log('Real-time trading disconnected');
      setIsConnected(false);
      
      toast({
        title: "Disconnected",
        description: "Real-time trading connection lost",
        variant: "destructive",
      });
    };

    // Register event handlers
    tradingWebSocket.on('auth_success', handleAuthSuccess);
    tradingWebSocket.on('auth_error', handleAuthError);
    tradingWebSocket.on('margin_update', handleMarginUpdate);
    tradingWebSocket.on('trade_opened', handleTradeOpened);
    tradingWebSocket.on('trade_closed', handleTradeClosed);
    tradingWebSocket.on('trade_error', handleTradeError);

    // Connect to WebSocket
    tradingWebSocket.connect();

    // Cleanup on unmount
    return () => {
      tradingWebSocket.off('auth_success', handleAuthSuccess);
      tradingWebSocket.off('auth_error', handleAuthError);
      tradingWebSocket.off('margin_update', handleMarginUpdate);
      tradingWebSocket.off('trade_opened', handleTradeOpened);
      tradingWebSocket.off('trade_closed', handleTradeClosed);
      tradingWebSocket.off('trade_error', handleTradeError);
    };
  }, [user]);

  // Trading actions using WebSocket
  const openTrade = useCallback(async (
    assetId: string,
    symbol: string,
    tradeType: 'BUY' | 'SELL',
    amount: number,
    leverage: number,
    openPrice: number,
    marginUsed: number
  ) => {
    if (!tradingWebSocket.isConnected()) {
      throw new Error('Not connected to real-time trading');
    }

    try {
      await tradingWebSocket.openTrade({
        assetId,
        symbol,
        tradeType,
        amount,
        leverage,
        openPrice,
        marginUsed
      });
      
      return true;
    } catch (error) {
      console.error('Failed to open trade:', error);
      throw error;
    }
  }, []);

  const closeTrade = useCallback(async (tradeId: string, closePrice: number) => {
    if (!tradingWebSocket.isConnected()) {
      throw new Error('Not connected to real-time trading');
    }

    try {
      await tradingWebSocket.closeTrade(tradeId, closePrice);
      return true;
    } catch (error) {
      console.error('Failed to close trade:', error);
      throw error;
    }
  }, []);

  // Derived state
  const openTrades = trades.filter(trade => trade.status === 'open');
  const closedTrades = trades.filter(trade => trade.status === 'closed');
  const botTrades = trades.filter(trade => trade.trade_source === 'bot');
  const userTrades = trades.filter(trade => trade.trade_source === 'user');
  const openBotTrades = trades.filter(trade => trade.status === 'open' && trade.trade_source === 'bot');
  const openUserTrades = trades.filter(trade => trade.status === 'open' && trade.trade_source === 'user');
  const closedBotTrades = trades.filter(trade => trade.status === 'closed' && trade.trade_source === 'bot');
  const closedUserTrades = trades.filter(trade => trade.status === 'closed' && trade.trade_source === 'user');

  return {
    // Connection state
    isConnected,
    loading,
    
    // Data
    profile,
    trades,
    openTrades,
    closedTrades,
    botTrades,
    userTrades,
    openBotTrades,
    openUserTrades,
    closedBotTrades,
    closedUserTrades,
    
    // Actions
    openTrade,
    closeTrade,
  };
};