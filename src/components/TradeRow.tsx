import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { SimplePriceIndicator } from "@/components/SimplePriceIndicator";
import { formatPnL } from "@/utils/pnlCalculator";
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

export const TradeRow = ({ trade, asset, onCloseTrade, isClosing }: TradeRowProps) => {
  const [localPnL, setLocalPnL] = useState(trade.pnl || 0);
  const [isLocalClosed, setIsLocalClosed] = useState(trade.status === 'closed');

  // Update local state when trade status changes
  useEffect(() => {
    if (trade.status === 'closed') {
      setIsLocalClosed(true);
      // Stop any further PnL calculations
      setLocalPnL(trade.pnl || 0);
    } else {
      setIsLocalClosed(false);
      setLocalPnL(trade.pnl || 0);
    }
  }, [trade.status, trade.pnl]);

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
  const change24h = asset?.change_24h || 0;

  return (
    <div key={trade.id} className="border rounded-lg p-4">
      <div className="grid md:grid-cols-8 gap-3 items-center text-sm">
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
            <SimplePriceIndicator 
              price={currentPrice}
              symbol={trade.symbol}
            />
          ) : (
            <div className="font-mono">
              {currentPrice.toFixed(trade.symbol.includes('JPY') ? 2 : 4)}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">24h Change</div>
          <div className={`flex items-center gap-1 ${change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change24h >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span className="font-mono text-xs">
              {change24h >= 0 ? '+' : ''}{change24h.toFixed(trade.symbol.includes('JPY') ? 2 : 4)}
            </span>
          </div>
        </div>
        
        <div>
          <div className="text-xs text-muted-foreground mb-1">P&L</div>
          <div className={`font-medium flex items-center gap-1 transition-colors duration-300 ${localPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {localPnL >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span className={!isLocalClosed ? "animate-pulse-subtle" : ""}>{formatPnL(localPnL)}</span>
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