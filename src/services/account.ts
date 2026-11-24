/**
 * The app's account store, wired to the database, the live trading link and the
 * idle detector. Screens use it through useTrades / useSharedUserProfile.
 */
import { supabase } from '@/integrations/supabase/client';
import { tradingWebSocketService } from '@/services/TradingWebSocketService';
import { userActivityManager } from '@/services/UserActivityManager';
import { toast } from '@/hooks/use-toast';
import { createAccountStore, type AccountApi, type Trade, type UserProfile } from './accountStore';

/** History kept on screen; open positions are always loaded in full on top of this */
const CLOSED_TRADES_LIMIT = 1000;

const newestFirst = (a: Trade, b: Trade) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);

const api: AccountApi = {
  fetchProfile: async (userId) => {
    const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as UserProfile | null;
  },

  fetchOpenTrades: async (userId) => {
    const { data, error } = await supabase.from('trades').select('*').eq('user_id', userId).eq('status', 'open');
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as Trade[]).sort(newestFirst);
  },

  // Two reads so an old position that is still open is never cut off by the history limit
  fetchTrades: async (userId) => {
    const [open, closed] = await Promise.all([
      supabase.from('trades').select('*').eq('user_id', userId).eq('status', 'open'),
      supabase.from('trades').select('*').eq('user_id', userId).neq('status', 'open')
        .order('created_at', { ascending: false }).limit(CLOSED_TRADES_LIMIT),
    ]);
    if (open.error) throw new Error(open.error.message);
    if (closed.error) throw new Error(closed.error.message);
    return ([...(open.data ?? []), ...(closed.data ?? [])] as unknown as Trade[]).sort(newestFirst);
  },

  // The database decides the real open price and margin; these values are only a request
  insertTrade: async (userId, t) => {
    const { error } = await supabase.from('trades').insert({
      user_id: userId,
      asset_id: t.assetId,
      symbol: t.symbol,
      trade_type: t.tradeType,
      amount: t.amount,
      leverage: t.leverage,
      open_price: t.openPrice,
      current_price: t.openPrice,
      margin_used: t.marginUsed,
      stop_loss_price: t.stopLoss,
      take_profit_price: t.takeProfit,
      status: 'open',
      trade_source: 'user',
      pnl: 0,
    });
    if (error) throw new Error(error.message);
  },

  closeTrade: async (tradeId, closePrice) => {
    const { data, error } = await supabase.rpc('close_trade_with_pnl', { p_trade_id: tradeId, p_close_price: closePrice });
    if (error) throw new Error(error.message);
    const refused = (data as { error?: string } | null)?.error;
    if (refused) throw new Error(refused);
  },
};

const isPaused = () =>
  (typeof document !== 'undefined' && document.hidden) || !userActivityManager.getState().isActive;

export const accountStore = createAccountStore({
  api,
  isPaused,
  socket: {
    on: (event, cb) => tradingWebSocketService.on(event, cb),
    isConnected: () => tradingWebSocketService.isConnected(),
    connect: () => void tradingWebSocketService.connect(),
    openTrade: (input) => tradingWebSocketService.openTrade(input),
    closeTrade: (tradeId, closePrice) => tradingWebSocketService.closeTrade(tradeId, closePrice),
  },
});

// Catch up the moment the client is back: tab shown again, network back, or first move after being idle
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) accountStore.checkNow();
  });
  window.addEventListener('online', () => accountStore.checkNow());
}

let wasActive = true;
userActivityManager.subscribe((isActive) => {
  tradingWebSocketService.setUserActivity(isActive);
  if (isActive && !wasActive) accountStore.checkNow();
  wasActive = isActive;
});

const signedUsd = (v: number) =>
  `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// One message per event, whichever screen is open. Bot trades follow the client's own
// bot alert settings instead (see useBotTradeNotifications).
accountStore.onTradeEvent(({ kind, trade, origin }) => {
  if (trade.trade_source === 'bot' && origin === 'server') return;
  if (kind === 'closed') {
    const pnl = Number(trade.pnl) || 0;
    toast({
      title: origin === 'self' ? 'Trade closed' : 'Position closed',
      description: `${trade.symbol} · P&L ${signedUsd(pnl)}`,
      variant: pnl >= 0 ? 'default' : 'destructive',
    });
  } else if (origin === 'server') {
    toast({ title: 'Position opened', description: `${trade.trade_type} ${Number(trade.amount)} ${trade.symbol}` });
  }
});
