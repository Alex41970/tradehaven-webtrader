import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, UTCTimestamp, CandlestickData } from "lightweight-charts";
import { supabase } from "@/integrations/supabase/client";
import { usePrices } from "@/contexts/PriceContext";
import { Button } from "@/components/ui/button";

interface TradingChartProps {
  symbol: string;
  category?: string;
  name?: string;
}

// Our own chart, built from the same price feed used for trading, so chart and quotes always match.
const TIMEFRAMES = [
  { label: "5m", seconds: 300, days: 2 },
  { label: "15m", seconds: 900, days: 5 },
  { label: "1H", seconds: 3600, days: 14 },
  { label: "4H", seconds: 14400, days: 30 },
] as const;

// Read a theme color (stored as "H S% L%") and convert to rgba for the chart library
const cssColor = (name: string, alpha = 1) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = v.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return `rgba(128, 128, 128, ${alpha})`;
  const h = +m[1], s = +m[2] / 100, l = +m[3] / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `rgba(${f(0)}, ${f(8)}, ${f(4)}, ${alpha})`;
};

type Row = { bucket: string; open: number; high: number; low: number; close: number };

function aggregate(rows: Row[], seconds: number): CandlestickData[] {
  const out = new Map<number, CandlestickData>();
  for (const r of rows) {
    const t = Math.floor(new Date(r.bucket).getTime() / 1000 / seconds) * seconds;
    const c = out.get(t);
    const o = Number(r.open), h = Number(r.high), l = Number(r.low), cl = Number(r.close);
    if (!c) out.set(t, { time: t as UTCTimestamp, open: o, high: h, low: l, close: cl });
    else {
      c.high = Math.max(c.high, h);
      c.low = Math.min(c.low, l);
      c.close = cl;
    }
  }
  return [...out.values()].sort((a, b) => (a.time as number) - (b.time as number));
}

export const TradingChart = ({ symbol, name }: TradingChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastCandleRef = useRef<CandlestickData | null>(null);
  const [tf, setTf] = useState<(typeof TIMEFRAMES)[number]>(TIMEFRAMES[0]);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");
  const { prices } = usePrices();
  const live = prices.get(symbol)?.price;

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: cssColor("--muted-foreground") },
      grid: {
        vertLines: { color: cssColor("--border", 0.5) },
        horzLines: { color: cssColor("--border", 0.5) },
      },
      rightPriceScale: { borderColor: cssColor("--border") },
      timeScale: { borderColor: cssColor("--border"), timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
    });
    const up = cssColor("--trading-success");
    const down = cssColor("--trading-danger");
    seriesRef.current = chart.addCandlestickSeries({
      upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down,
    });
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Load history for symbol + timeframe
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setState("loading");
    (async () => {
      const since = new Date(Date.now() - tf.days * 86400_000).toISOString();
      const rows: Row[] = [];
      // Page through results (the API returns at most 1000 rows per request)
      for (let from = 0; from < 10000; from += 1000) {
        const { data, error } = await supabase
          .from("price_candles")
          .select("bucket, open, high, low, close")
          .eq("symbol", symbol)
          .gte("bucket", since)
          .order("bucket", { ascending: true })
          .range(from, from + 999);
        if (error || !data) break;
        rows.push(...(data as Row[]));
        if (data.length < 1000) break;
      }
      if (cancelled || !seriesRef.current) return;
      const candles = aggregate(rows, tf.seconds);
      seriesRef.current.setData(candles);
      lastCandleRef.current = candles[candles.length - 1] ?? null;
      chartRef.current?.timeScale().fitContent();
      setState(candles.length ? "ready" : "empty");
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, tf]);

  // Move the latest candle with the live price
  useEffect(() => {
    if (!live || !seriesRef.current || state === "loading") return;
    const now = Math.floor(Date.now() / 1000 / tf.seconds) * tf.seconds;
    const last = lastCandleRef.current;
    const candle: CandlestickData =
      last && last.time === now
        ? { ...last, high: Math.max(last.high, live), low: Math.min(last.low, live), close: live }
        : { time: now as UTCTimestamp, open: last?.close ?? live, high: Math.max(last?.close ?? live, live), low: Math.min(last?.close ?? live, live), close: live };
    if (last && (last.time as number) > now) return;
    seriesRef.current.update(candle);
    lastCandleRef.current = candle;
    if (state === "empty") setState("ready");
  }, [live, tf.seconds, state]);

  const title = useMemo(() => name || symbol, [name, symbol]);

  return (
    <div className="w-full h-full flex flex-col rounded-lg border border-border bg-card animate-fade-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <div className="flex gap-1">
          {TIMEFRAMES.map((t) => (
            <Button
              key={t.label}
              size="sm"
              variant={t.label === tf.label ? "secondary" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setTf(t)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        {state !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
            {state === "loading" ? `Loading ${symbol} chart...` : "Chart history is being collected for this market"}
          </div>
        )}
      </div>
    </div>
  );
};
