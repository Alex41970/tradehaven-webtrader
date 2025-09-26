import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { PulsingPriceIndicator } from "@/components/PulsingPriceIndicator";
import { formatPnL, calculateRealTimePnL } from "@/utils/pnlCalculator";
import { Trade } from "@/hooks/useTrades";
import { useIsMobile } from "@/hooks/use-mobile";

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

export const TradeRow = ({ trade, asset, onCloseTrade, isClosing }: TradeRowProps) => {
  const [isLocalClosed, setIsLocalClosed] = useState(trade.status === 'closed');
  const isMobile = useIsMobile();

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

  if (isMobile) {
    return (
      <div key={trade.id} className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="font-medium">{trade.symbol}</div>
            <Badge variant={trade.trade_type === "BUY" ? "default" : "destructive"} className="text-xs">
              {trade.trade_type}
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Amount</div>
            <div className="font-medium">${Number(trade.amount).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Open Price</div>
            <div className="font-mono">{Number(trade.open_price).toFixed(trade.symbol.includes('JPY') ? 2 : 4)}</div>
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Current Price</div>
          {asset && asset.price && !isLocalClosed ? (
            <PulsingPriceIndicator 
              price={currentPrice}
              change={asset.change_24h}
              symbol={trade.symbol}
            />
          ) : (
            <div className="font-mono">
              {currentPrice.toFixed(trade.symbol.includes('JPY') ? 2 : 4)}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">P&L</div>
          <div className={`font-medium flex items-center gap-1 transition-colors duration-300 ${realTimePnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {realTimePnL >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span className={!isLocalClosed ? "animate-pulse-subtle" : ""}>{formatPnL(realTimePnL)}</span>
          </div>
        </div>
        
        <Button 
          size="sm" 
          variant="destructive"
          onClick={handleCloseClick}
          className="w-full"
          disabled={isClosing || isLocalClosed}
        >
          {isClosing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              Closing...
            </>
          ) : isLocalClosed ? (
            'Closing...'
          ) : (
            'Close Position'
          )}
        </Button>
      </div>
    );
  }

  return (
    <div key={trade.id} className="border rounded-lg p-4">
      <div className="grid md:grid-cols-7 gap-3 items-center text-sm">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Symbol</div>
          <div className="font-medium">{trade.symbol}</div>
          <Badge variant={trade.trade_type === "BUY" ? "default" : "destructive"} className="text-xs mt-1">
            {trade.trade_type}
          </Badge>
        </div>
        
        <div>
          <div className="text-xs text-muted-foreground mb-1">Amount</div>
          <div className="font-medium">${Number(trade.amount).toFixed(2)}</div>
        </div>
        
        <div>
          <div className="text-xs text-muted-foreground mb-1">Open Price</div>
          <div className="font-mono">{Number(trade.open_price).toFixed(trade.symbol.includes('JPY') ? 2 : 4)}</div>
        </div>
        
        <div>
          <div className="text-xs text-muted-foreground mb-1">Current Price</div>
          {asset && asset.price && !isLocalClosed ? (
            <PulsingPriceIndicator 
              price={currentPrice}
              change={asset.change_24h}
              symbol={trade.symbol}
            />
          ) : (
            <div className="font-mono">
              {currentPrice.toFixed(trade.symbol.includes('JPY') ? 2 : 4)}
            </div>
          )}
        </div>

        
        <div>
          <div className="text-xs text-muted-foreground mb-1">P&L</div>
          <div className={`font-medium flex items-center gap-1 transition-colors duration-300 ${realTimePnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {realTimePnL >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span className={!isLocalClosed ? "animate-pulse-subtle" : ""}>{formatPnL(realTimePnL)}</span>
          </div>
        </div>
        
        <div className="col-span-2">
          <div className="text-xs text-muted-foreground mb-1">Action</div>
          <Button 
            size="sm" 
            variant="destructive"
            onClick={handleCloseClick}
            className="w-full"
            disabled={isClosing || isLocalClosed}
          >
            {isClosing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Closing...
              </>
            ) : isLocalClosed ? (
              'Closing...'
            ) : (
              'Close Position'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};