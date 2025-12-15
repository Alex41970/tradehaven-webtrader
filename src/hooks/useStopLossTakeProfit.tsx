import { useEffect, useRef, useCallback } from 'react';
import { useRealTimePrices } from './useRealTimePrices';
import { useToast } from './use-toast';
import { Trade } from './useTrades';

interface UseStopLossTakeProfitProps {
  openTrades: Trade[];
  onCloseTrade: (tradeId: string, closePrice: number) => Promise<boolean | void>;
}

export const useStopLossTakeProfit = ({ openTrades, onCloseTrade }: UseStopLossTakeProfitProps) => {
  const { prices } = useRealTimePrices();
  const { toast } = useToast();
  const closingTradesRef = useRef<Set<string>>(new Set());
  const lastCheckRef = useRef<number>(0);

  const checkAndExecuteSLTP = useCallback(() => {
    // Throttle checks to every 500ms minimum
    const now = Date.now();
    if (now - lastCheckRef.current < 500) return;
    lastCheckRef.current = now;

    // Filter trades with SL or TP set
    const tradesWithSLTP = openTrades.filter(
      trade => trade.stop_loss_price || trade.take_profit_price
    );

    if (tradesWithSLTP.length === 0) return;

    tradesWithSLTP.forEach(trade => {
      // Skip if already closing this trade
      if (closingTradesRef.current.has(trade.id)) return;

      // Get current price
      const priceUpdate = prices.get(trade.symbol);
      if (!priceUpdate?.price) return;

      const currentPrice = priceUpdate.price;
      let triggered: 'stop_loss' | 'take_profit' | null = null;

      if (trade.trade_type === 'BUY') {
        // BUY: SL triggers when price drops to/below SL, TP triggers when price rises to/above TP
        if (trade.stop_loss_price && currentPrice <= trade.stop_loss_price) {
          triggered = 'stop_loss';
        } else if (trade.take_profit_price && currentPrice >= trade.take_profit_price) {
          triggered = 'take_profit';
        }
      } else {
        // SELL: SL triggers when price rises to/above SL, TP triggers when price drops to/below TP
        if (trade.stop_loss_price && currentPrice >= trade.stop_loss_price) {
          triggered = 'stop_loss';
        } else if (trade.take_profit_price && currentPrice <= trade.take_profit_price) {
          triggered = 'take_profit';
        }
      }

      if (triggered) {
        // Mark as closing to prevent duplicate executions
        closingTradesRef.current.add(trade.id);

        // Execute the close
        onCloseTrade(trade.id, currentPrice)
          .then(() => {
            toast({
              title: triggered === 'stop_loss' ? '🛑 Stop Loss Triggered' : '🎯 Take Profit Triggered',
              description: `${trade.symbol} ${trade.trade_type} position closed at $${currentPrice.toFixed(4)}`,
              variant: triggered === 'stop_loss' ? 'destructive' : 'default',
            });
          })
          .catch(() => {
            toast({
              title: 'Auto-close failed',
              description: `Failed to execute ${triggered === 'stop_loss' ? 'Stop Loss' : 'Take Profit'} for ${trade.symbol}`,
              variant: 'destructive',
            });
          })
          .finally(() => {
            // Remove from closing set after a delay to prevent immediate re-trigger
            setTimeout(() => {
              closingTradesRef.current.delete(trade.id);
            }, 2000);
          });
      }
    });
  }, [openTrades, prices, onCloseTrade, toast]);

  // Check on every price update
  useEffect(() => {
    if (openTrades.length === 0) return;
    
    // Check immediately when prices change
    checkAndExecuteSLTP();
  }, [prices, checkAndExecuteSLTP, openTrades.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closingTradesRef.current.clear();
    };
  }, []);
};
