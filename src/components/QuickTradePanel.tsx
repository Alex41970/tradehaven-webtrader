import { Minus, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface QuickTradePanelProps {
  price: number;
  lots: number;
  leverage: number;
  minLots?: number;
  margin: number;
  busy?: boolean;
  onLotsChange: (v: number) => void;
  onLeverageChange: (v: number) => void;
  onTrade: (side: "BUY" | "SELL") => void;
}

const LEVERAGES = [1, 5, 10, 20, 50, 100, 200, 500];
const fmtPrice = (n: number) => (n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(4) : n.toFixed(5));

/** MT4/MT5-style one-click trade widget shown over the fullscreen chart. */
export const QuickTradePanel = ({ price, lots, leverage, minLots = 0.01, margin, busy, onLotsChange, onLeverageChange, onTrade }: QuickTradePanelProps) => {
  const step = lots >= 1 ? 0.1 : 0.01;
  const setLots = (v: number) => onLotsChange(Math.max(minLots, Math.round(v * 100) / 100));
  const [whole, frac] = fmtPrice(price).split(".");

  const PriceBtn = ({ side }: { side: "BUY" | "SELL" }) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => onTrade(side)}
      className={`flex w-28 flex-col items-center rounded-md px-2 py-1.5 transition-opacity disabled:opacity-50 hover:opacity-90 ${
        side === "SELL" ? "bg-destructive text-destructive-foreground" : "bg-success text-success-foreground"
      }`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90">{side}</span>
      <span className="font-mono leading-none tabular-nums">
        <span className="text-xs">{whole}.</span>
        <span className="text-lg font-bold">{frac?.slice(0, -1)}</span>
        <sup className="text-[10px]">{frac?.slice(-1)}</sup>
      </span>
    </button>
  );

  return (
    <div className="rounded-lg border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur">
      <div className="flex items-stretch gap-1.5">
        <PriceBtn side="SELL" />
        <div className="flex w-24 flex-col items-center justify-center gap-1">
          <div className="flex items-center rounded border border-border bg-background">
            <button type="button" aria-label="Fewer lots" className="px-1 py-0.5 text-muted-foreground hover:text-foreground" onClick={() => setLots(lots - step)}><Minus className="h-3 w-3" /></button>
            <input
              aria-label="Lots"
              type="number"
              step={step}
              min={minLots}
              value={lots}
              onChange={(e) => setLots(Number(e.target.value) || minLots)}
              className="w-12 bg-transparent text-center font-mono text-xs tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button type="button" aria-label="More lots" className="px-1 py-0.5 text-muted-foreground hover:text-foreground" onClick={() => setLots(lots + step)}><Plus className="h-3 w-3" /></button>
          </div>
          <Select value={String(leverage)} onValueChange={(v) => onLeverageChange(Number(v))}>
            <SelectTrigger aria-label="Leverage" className="h-6 w-full px-2 text-[11px] font-mono"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[60]">
              {LEVERAGES.map((l) => <SelectItem key={l} value={String(l)} className="text-xs font-mono">1:{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <PriceBtn side="BUY" />
      </div>
      <div className="mt-1 text-center text-[10px] text-muted-foreground">
        Margin <span className="font-mono text-foreground">${margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
};
