import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { isMarketOpen, nextMarketOpen, formatOpensAt } from "@/utils/marketHours";

export function useMarketSession(symbol?: string, category?: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  if (!symbol) return { open: true, label: "" };
  const open = isMarketOpen(symbol, category, now);
  const next = open ? null : nextMarketOpen(symbol, category, now);
  return { open, label: next ? formatOpensAt(next, now) : "" };
}

export function MarketClosedBanner({ symbol, category }: { symbol?: string; category?: string }) {
  const { open, label } = useMarketSession(symbol, category);
  if (open) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
      <Moon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-foreground">
        <span className="font-medium">Market closed</span>
        {label && <span className="text-muted-foreground"> · {label}</span>}
        <span className="text-muted-foreground"> · You can place a pending order now.</span>
      </span>
    </div>
  );
}
