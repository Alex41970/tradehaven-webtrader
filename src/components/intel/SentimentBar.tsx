import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { estimateBullish, blendSentiment } from "@/utils/marketIntel";
import { Users, Activity } from "lucide-react";

export const SentimentBar = ({ symbol, change24h, category }: { symbol: string; change24h: number; category?: string }) => {
  const [real, setReal] = useState<{ buy: number; sell: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.rpc("get_market_sentiment", { _symbol: symbol });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : null;
      setReal(row ? { buy: Number(row.buy_lots), sell: Number(row.sell_lots) } : null);
    };
    setReal(null);
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol]);

  const { bullish, source } = blendSentiment(estimateBullish(change24h, category), real);
  const bearish = 100 - bullish;
  const Icon = source === "traders" ? Users : Activity;

  return (
    <div className="bento p-4">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="label-caps flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{source === "traders" ? "Trader sentiment" : "Market sentiment"}</span>
        <span className="text-muted-foreground">{symbol}</span>
      </div>
      <div className="mb-2 text-sm">
        <span className={bullish >= 50 ? "font-semibold text-success" : "font-semibold text-destructive"}>
          {bullish >= 50 ? `${bullish}% bullish` : `${bearish}% bearish`}
        </span>
        <span className="text-muted-foreground"> on {symbol}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-success transition-all" style={{ width: `${bullish}%` }} />
        <div className="bg-destructive transition-all" style={{ width: `${bearish}%` }} />
      </div>
      <div className="num mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>Buy {bullish}%</span><span>Sell {bearish}%</span>
      </div>
    </div>
  );
};
