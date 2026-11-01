import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Loader2, Target, ShieldAlert } from "lucide-react";
import { formatPnL, calculateRealTimePnL } from "@/utils/pnlCalculator";
import { Trade } from "@/hooks/useTrades";

interface TradeRowProps {
  trade: Trade;
  asset?: {
    price: number;
    change_24h: number;
    symbol: string;
  };
  onCloseTrade: (tradeId: string, symbol: string) => Promise<void>;
  isClosing: boolean;
}

const TradeRowComponent = ({ trade, asset, onCloseTrade, isClosing }: TradeRowProps) => {
  const [isLocalClosed, setIsLocalClosed] = useState(trade.status === 'closed');

  // Calculate real-time P&L when trade is open and asset price is available
  const realTimePnL = useMemo(() => {
    // If trade is closed, use stored P&L
    if (trade.status === 'closed' || isLocalClosed) {
      return trade.pnl || 0;
    }

    // For open trades, calculate real-time P&L if current price is available
    if (asset?.price) {
      return calculateRealTimePnL(
        {
          trade_type: trade.trade_type,
          symbol: trade.symbol,
          amount: trade.amount,
          open_price: trade.open_price,
          leverage: trade.leverage
        },
        asset.price
      );
    }

    // Fall back to stored P&L if no real-time price
    return trade.pnl || 0;
  }, [trade, asset?.price, isLocalClosed]);

  // Update local state when trade status changes
  useEffect(() => {
    if (trade.status === 'closed') {
      setIsLocalClosed(true);
    } else {
      setIsLocalClosed(false);
    }
  }, [trade.status]);

  const handleCloseClick = useCallback(async () => {
    // Immediately mark as closing locally to prevent UI flickering
    setIsLocalClosed(true);
    await onCloseTrade(trade.id, trade.symbol);
  }, [trade.id, trade.symbol, onCloseTrade]);

  // Don't render if locally marked as closed (for immediate UI response)
  if (isLocalClosed && trade.status === 'closed') {
    return null;
  }

  const currentPrice = asset?.price || trade.current_price || trade.open_price || 0;
  const open = Number(trade.open_price);
  const dp = (v: number) => (v >= 1000 ? 2 : v >= 10 ? 2 : v >= 1 ? 4 : 5);
  const fmt = (v: number) => Number(v).toFixed(trade.symbol.includes("JPY") ? 3 : dp(Math.abs(v)));
  const isBuy = trade.trade_type === "BUY";
  const up = realTimePnL >= 0;
  const movePct = open ? ((currentPrice - open) / open) * 100 * (isBuy ? 1 : -1) : 0;

  return (
    <div className="rounded-xl border border-border bg-card/60 p-3 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider ${isBuy ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
              {trade.trade_type}
            </span>
            <span className="num truncate font-semibold text-foreground">{trade.symbol}</span>
          </div>
          <div className="num mt-1 text-xs text-muted-foreground">{Number(trade.amount)} lot{Number(trade.amount) === 1 ? "" : "s"}</div>
        </div>
        <div className="text-right">
          <div className={`num flex items-center justify-end gap-1 text-base font-semibold ${up ? "text-success" : "text-destructive"}`}>
            {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {formatPnL(realTimePnL)}
          </div>
          <div className={`num text-[11px] ${up ? "text-success/80" : "text-destructive/80"}`}>{movePct >= 0 ? "+" : ""}{movePct.toFixed(2)}%</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-background/60 p-2 text-xs">
        <div>
          <div className="text-muted-foreground">Open</div>
          <div className="num text-foreground">{fmt(open)}</div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground">Current</div>
          <div className="num text-foreground">{fmt(currentPrice)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1.5 text-[11px]">
          {trade.stop_loss_price ? (
            <span className="num inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-destructive"><ShieldAlert className="h-3 w-3" />SL {fmt(trade.stop_loss_price)}</span>
          ) : null}
          {trade.take_profit_price ? (
            <span className="num inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-success"><Target className="h-3 w-3" />TP {fmt(trade.take_profit_price)}</span>
          ) : null}
          {!trade.stop_loss_price && !trade.take_profit_price && <span className="text-muted-foreground">No SL / TP</span>}
        </div>
        <Button size="sm" variant="outline" onClick={handleCloseClick} disabled={isClosing || isLocalClosed}
          className="h-8 shrink-0 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground">
          {isClosing || isLocalClosed ? (<><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Closing</>) : "Close"}
        </Button>
      </div>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const TradeRow = React.memo(TradeRowComponent, (prevProps, nextProps) => {
  return (
    prevProps.trade.id === nextProps.trade.id &&
    prevProps.trade.status === nextProps.trade.status &&
    prevProps.trade.pnl === nextProps.trade.pnl &&
    prevProps.trade.stop_loss_price === nextProps.trade.stop_loss_price &&
    prevProps.trade.take_profit_price === nextProps.trade.take_profit_price &&
    prevProps.asset?.price === nextProps.asset?.price &&
    prevProps.asset?.change_24h === nextProps.asset?.change_24h &&
    prevProps.isClosing === nextProps.isClosing
  );
});