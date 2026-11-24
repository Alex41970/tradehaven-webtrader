import { useCallback, useMemo } from 'react';
import { useAccount } from './useAccount';
import { useTrades } from './useTrades';
import { useRealtimePnL } from './useRealtimePnL';
import { useAssets } from './useAssets';
import { computeAccountMetrics, splitBalance } from '@/utils/accountMetrics';

/**
 * The account figures shown to the client, worked out from the shared account record
 * (own funds, credit, open positions) and live prices. With no open positions nothing
 * here depends on prices, so equity stands still.
 */
export const useRealtimeAccountMetrics = () => {
  const profile = useAccount((s) => s.profile);
  const { openTrades } = useTrades();
  const { assets } = useAssets();
  const { tradePnL, totalPnL, lastUpdated } = useRealtimePnL(openTrades, assets);

  const metrics = useMemo(() => {
    const realTimeBalance = Number(profile?.balance) || 0;
    const credit = Number(profile?.credit) || 0;
    const openPnL = Number(totalPnL) || 0;
    const totalUsedMargin = openTrades.reduce((sum, trade) => sum + (Number(trade.margin_used) || 0), 0);
    const m = computeAccountMetrics({ balance: realTimeBalance, credit, usedMargin: totalUsedMargin, openPnL });

    return {
      /** The client's own money */
      realTimeBalance,
      /** Company money: usable for trading, never withdrawable */
      credit,
      /** Headline balance: own funds + credit */
      totalBalance: splitBalance({ balance: realTimeBalance, credit }).total,
      /** Profit or loss of the positions that are still open */
      openPnL,
      realTimeEquity: m.equity,
      realTimeFreeMargin: m.freeMargin,
      totalUsedMargin,
      /** Percent; null when nothing is open */
      marginLevel: m.marginLevel,
      /** Own money that can leave the account right now (credit excluded) */
      withdrawable: m.withdrawable,
    };
  }, [profile?.balance, profile?.credit, totalPnL, openTrades]);

  const canOpenTrade = useCallback(
    (requiredMargin: number): boolean => metrics.realTimeFreeMargin >= requiredMargin,
    [metrics.realTimeFreeMargin],
  );

  return { ...metrics, tradePnL, lastUpdated, canOpenTrade };
};
