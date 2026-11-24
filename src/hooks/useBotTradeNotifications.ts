import { useEffect } from 'react';
import { accountStore } from '@/services/account';
import { useNotifications } from './useNotifications';

interface BotAlertSettings {
  notifyTradeOpened: boolean;
  notifyTradeClosed: boolean;
  notifyProfitLoss: boolean;
}

/**
 * Tells the client when their trading bot opens or closes a position, following the
 * alert switches in their bot settings. Mount once (the dashboard does).
 */
export const useBotTradeNotifications = (settings?: BotAlertSettings) => {
  const { showNotification } = useNotifications();

  useEffect(() => {
    if (!settings) return;
    return accountStore.onTradeEvent(({ kind, trade, origin }) => {
      if (trade.trade_source !== 'bot' || origin !== 'server') return;
      if (kind === 'opened') {
        showNotification({
          title: 'Bot opened a position',
          body: `${trade.trade_type} ${Number(trade.amount)} ${trade.symbol}`,
          type: 'trade_opened',
          tradeSource: 'bot',
          botSettings: settings,
        });
      } else {
        const pnl = Number(trade.pnl) || 0;
        showNotification({
          title: 'Bot closed a position',
          body: `${trade.symbol} · ${pnl >= 0 ? 'Profit' : 'Loss'} $${Math.abs(pnl).toFixed(2)}`,
          type: 'trade_closed',
          tradeSource: 'bot',
          botSettings: settings,
        });
      }
    });
  }, [settings, showNotification]);
};
