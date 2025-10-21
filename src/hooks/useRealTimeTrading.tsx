import { useEffect, useState, useCallback } from 'react';
import { tradingWebSocket, TradingWebSocketMessage } from '@/services/TradingWebSocketService';
import { useAuth } from './useAuth';
import { useConnectionMonitor } from './useConnectionMonitor';
import { useActivity } from '@/contexts/ActivityContext';
import { toast } from '@/hooks/use-toast';
import { useNotifications } from './useNotifications';
import { useBotStatus } from './useBotStatus';

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
  const { isOnline, isSlowConnection } = useConnectionMonitor();
  const { isUserActive } = useActivity();
  const { showNotification } = useNotifications();
  const { botStatus } = useBotStatus();
  const [isConnected, setIsConnected] = useState(false);
  const [profile, setProfile] = useState<RealTimeUserProfile | null>(null);
  const [trades, setTrades] = useState<RealTimeTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'offline'>('offline');

  // Sync activity state with trading WebSocket service
  useEffect(() => {
    tradingWebSocket.setUserActivity(isUserActive);
  }, [isUserActive]);
  
  // Setup WebSocket event handlers
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const handleAuthSuccess = (message: TradingWebSocketMessage) => {
      setIsConnected(true);
      setLoading(false);
      setConnectionQuality('excellent');
      
      // Set initial data from authentication response
      if (message.profile) {
        setProfile(message.profile);
      }
      if (message.trades) {
        setTrades(message.trades);
      }

      // Show connection quality toast for slow connections
      if (isSlowConnection) {
        toast({
          title: "Slow Connection Detected",
          description: "Real-time updates may be delayed",
          variant: "default",
        });
      }
    };

    const handleMarginUpdate = (message: TradingWebSocketMessage) => {
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
      // Update trades
      if (message.trades) {
        setTrades(message.trades);
      }
      
      // Update profile
      if (message.profile) {
        setProfile(message.profile);
      }
      
      // Show toast notification
      toast({
        title: "Trade Opened",
        description: `${message.trade.trade_type} ${message.trade.symbol}`,
      });

      // Show bot notification if it's a bot trade
      if (message.trade?.trade_source === 'bot' && botStatus.permissions?.settings) {
        showNotification({
          title: '🤖 Bot Trade Opened',
          body: `${message.trade.symbol} ${message.trade.trade_type} - $${message.trade.amount.toFixed(2)}`,
          type: 'trade_opened',
          tradeSource: 'bot',
          botSettings: botStatus.permissions.settings,
        });
      }
    };

    const handleTradeClosed = (message: TradingWebSocketMessage) => {
      // Update trades
      if (message.trades) {
        setTrades(message.trades);
      }
      
      // Update profile
      if (message.profile) {
        setProfile(message.profile);
      }
      
      const pnl = message.pnl || message.trade?.pnl || 0;
      
      // Show toast notification
      toast({
        title: "Trade Closed",
        description: `P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
        variant: pnl >= 0 ? "default" : "destructive",
      });

      // Show bot notification if it's a bot trade
      if (message.tradeSource === 'bot' && botStatus.permissions?.settings) {
        const isProfitable = pnl > 0;
        showNotification({
          title: '🤖 Bot Trade Closed',
          body: `${isProfitable ? '✅ Profit' : '❌ Loss'}: $${Math.abs(pnl).toFixed(2)}`,
          type: 'trade_closed',
          tradeSource: 'bot',
          botSettings: botStatus.permissions.settings,
        });
      }
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
      setIsConnected(false);
      setConnectionQuality('offline');
      
      // Only show disconnect toast if we were previously connected
      if (isConnected) {
        toast({
          title: "Connection Lost",
          description: isOnline ? "Attempting to reconnect..." : "You are offline",
          variant: "destructive",
        });
      }
    };

    const handleConnectionQualityUpdate = () => {
      const state = tradingWebSocket.getConnectionState();
      setConnectionQuality(state.quality);
      
      if (state.quality === 'poor' && state.latency > 1000) {
        toast({
          title: "Poor Connection",
          description: "Real-time updates may be slow or delayed",
          variant: "default",
        });
      }
    };

    // Register event handlers
    tradingWebSocket.on('auth_success', handleAuthSuccess);
    tradingWebSocket.on('auth_error', handleAuthError);
    tradingWebSocket.on('margin_update', handleMarginUpdate);
    tradingWebSocket.on('trade_opened', handleTradeOpened);
    tradingWebSocket.on('trade_closed', handleTradeClosed);
    tradingWebSocket.on('trade_error', handleTradeError);
    tradingWebSocket.on('pong', handleConnectionQualityUpdate);

    // Connect to WebSocket
    tradingWebSocket.connect();

    // Periodic connection quality check
    const qualityCheckInterval = setInterval(() => {
      handleConnectionQualityUpdate();
    }, 30000);

    // Cleanup on unmount
    return () => {
      clearInterval(qualityCheckInterval);
      tradingWebSocket.off('auth_success', handleAuthSuccess);
      tradingWebSocket.off('auth_error', handleAuthError);
      tradingWebSocket.off('margin_update', handleMarginUpdate);
      tradingWebSocket.off('trade_opened', handleTradeOpened);
      tradingWebSocket.off('trade_closed', handleTradeClosed);
      tradingWebSocket.off('trade_error', handleTradeError);
      tradingWebSocket.off('pong', handleConnectionQualityUpdate);
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
    marginUsed: number,
    stopLoss?: number,
    takeProfit?: number
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
        marginUsed,
        stopLoss,
        takeProfit
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
    connectionQuality,
    isOnline,
    isSlowConnection,
    
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