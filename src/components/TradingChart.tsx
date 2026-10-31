import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart, IChartApi, ISeriesApi, UTCTimestamp, CandlestickData, LineStyle, CrosshairMode, SeriesType, Time,
} from "lightweight-charts";
import { supabase } from "@/integrations/supabase/client";
import { usePrices } from "@/contexts/PriceContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Activity, CandlestickChart, LineChart, AreaChart, BarChart3, Maximize2, Minimize2 } from "lucide-react";
import { sma, ema, bollinger, rsi, macd, vwapLike } from "@/utils/indicators";

interface TradingChartProps {
  symbol: string;
  category?: string;
  name?: string;
}

// Our own chart, built from the same price feed used for trading, so chart and quotes always match.
const TIMEFRAMES = [
  { label: "5m", seconds: 300, days: 3 },
  { label: "15m", seconds: 900, days: 7 },
  { label: "30m", seconds: 1800, days: 14 },
  { label: "1H", seconds: 3600, days: 30 },
  { label: "4H", seconds: 14400, days: 30 },
  { label: "1D", seconds: 86400, days: 30 },
] as const;

type ChartType = "candles" | "bars" | "line" | "area";
const CHART_TYPES: { id: ChartType; icon: typeof LineChart; label: string }[] = [
  { id: "candles", icon: CandlestickChart, label: "Candles" },
  { id: "bars", icon: BarChart3, label: "Bars" },
  { id: "line", icon: LineChart, label: "Line" },
  { id: "area", icon: AreaChart, label: "Area" },
];

type IndicatorId = "sma20" | "sma50" | "ema20" | "ema200" | "bb" | "vwap" | "rsi" | "macd";
const INDICATORS: { id: IndicatorId; label: string }[] = [
  { id: "sma20", label: "SMA 20" },
  { id: "sma50", label: "SMA 50" },
  { id: "ema20", label: "EMA 20" },
  { id: "ema200", label: "EMA 200" },
  { id: "bb", label: "Bollinger Bands (20, 2)" },
  { id: "vwap", label: "Typical Price Avg" },
  { id: "rsi", label: "RSI (14)" },
  { id: "macd", label: "MACD (12, 26, 9)" },
];
const IND_COLORS: Record<string, string> = {
  sma20: "#f5a623", sma50: "#4a90e2", ema20: "#bd10e0", ema200: "#e94e77", bb: "#2a9d8f", vwap: "#e9c46a",
};
const STORAGE_KEY = "chart-prefs-v1";

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
    else { c.high = Math.max(c.high, h); c.low = Math.min(c.low, l); c.close = cl; }
  }
  return [...out.values()].sort((a, b) => (a.time as number) - (b.time as number));
}

const loadPrefs = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
};

const fmt = (n?: number) => (n == null ? "-" : n >= 100 ? n.toFixed(2) : n.toFixed(5));

export const TradingChart = ({ symbol, name }: TradingChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const overlayRefs = useRef<ISeriesApi<SeriesType>[]>([]);
  const candlesRef = useRef<CandlestickData[]>([]);
  const prefs = useMemo(loadPrefs, []);
  const [tf, setTf] = useState<(typeof TIMEFRAMES)[number]>(TIMEFRAMES.find((t) => t.label === prefs.tf) ?? TIMEFRAMES[1]);
  const [type, setType] = useState<ChartType>(prefs.type ?? "candles");
  const [active, setActive] = useState<IndicatorId[]>(prefs.ind ?? ["ema20", "bb"]);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");
  const [rows, setRows] = useState<CandlestickData[]>([]);
  const [legend, setLegend] = useState<CandlestickData | null>(null);
  const [full, setFull] = useState(false);
  const { prices } = usePrices();
  const live = prices.get(symbol)?.price;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tf: tf.label, type, ind: active }));
  }, [tf, type, active]);

  // Create chart
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: cssColor("--muted-foreground"), fontSize: 11 },
      grid: {
        vertLines: { color: cssColor("--border", 0.25) },
        horzLines: { color: cssColor("--border", 0.25) },
      },
      rightPriceScale: { borderColor: cssColor("--border", 0.6), scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: cssColor("--border", 0.6), timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 8 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: cssColor("--muted-foreground", 0.5), style: LineStyle.Dashed, labelBackgroundColor: cssColor("--secondary") },
        horzLine: { color: cssColor("--muted-foreground", 0.5), style: LineStyle.Dashed, labelBackgroundColor: cssColor("--secondary") },
      },
    });
    chart.subscribeCrosshairMove((p) => {
      const t = p.time as number | undefined;
      const c = t ? candlesRef.current.find((x) => x.time === t) : null;
      setLegend(c ?? candlesRef.current[candlesRef.current.length - 1] ?? null);
    });
    chartRef.current = chart;
    return () => { chart.remove(); chartRef.current = null; mainRef.current = null; overlayRefs.current = []; };
  }, []);

  // Load history
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setState("loading");
    (async () => {
      const since = new Date(Date.now() - tf.days * 86400_000).toISOString();
      const all: Row[] = [];
      for (let from = 0; from < 12000; from += 1000) {
        const { data, error } = await supabase
          .from("price_candles").select("bucket, open, high, low, close")
          .eq("symbol", symbol).gte("bucket", since)
          .order("bucket", { ascending: true }).range(from, from + 999);
        if (error || !data) break;
        all.push(...(data as Row[]));
        if (data.length < 1000) break;
      }
      if (cancelled) return;
      const c = aggregate(all, tf.seconds);
      candlesRef.current = c;
      setRows(c);
      setLegend(c[c.length - 1] ?? null);
      setState(c.length ? "ready" : "empty");
    })();
    return () => { cancelled = true; };
  }, [symbol, tf]);

  // (Re)build series when data, type, or indicators change
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (mainRef.current) chart.removeSeries(mainRef.current);
    overlayRefs.current.forEach((s) => chart.removeSeries(s));
    overlayRefs.current = [];

    const up = cssColor("--trading-success");
    const down = cssColor("--trading-danger");
    const primary = cssColor("--primary");
    const data = rows;
    const closes = data.map((d) => d.close);
    const times = data.map((d) => d.time);
    const lower = active.includes("rsi") || active.includes("macd");
    const both = active.includes("rsi") && active.includes("macd");
    chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.06, bottom: lower ? (both ? 0.42 : 0.26) : 0.06 } });

    let main: ISeriesApi<SeriesType>;
    if (type === "candles") {
      main = chart.addCandlestickSeries({ upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down });
      main.setData(data);
    } else if (type === "bars") {
      main = chart.addBarSeries({ upColor: up, downColor: down, thinBars: false });
      main.setData(data);
    } else if (type === "line") {
      main = chart.addLineSeries({ color: primary, lineWidth: 2 });
      main.setData(data.map((d) => ({ time: d.time, value: d.close })));
    } else {
      main = chart.addAreaSeries({ lineColor: primary, topColor: cssColor("--primary", 0.35), bottomColor: cssColor("--primary", 0), lineWidth: 2 });
      main.setData(data.map((d) => ({ time: d.time, value: d.close })));
    }
    mainRef.current = main;

    const line = (vals: (number | null)[], color: string, opts: Record<string, unknown> = {}) => {
      const s = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...opts });
      s.setData(vals.map((v, i) => (v == null ? { time: times[i] as Time } : { time: times[i] as Time, value: v })));
      overlayRefs.current.push(s);
      return s;
    };

    if (active.includes("sma20")) line(sma(closes, 20), IND_COLORS.sma20);
    if (active.includes("sma50")) line(sma(closes, 50), IND_COLORS.sma50);
    if (active.includes("ema20")) line(ema(closes, 20), IND_COLORS.ema20);
    if (active.includes("ema200")) line(ema(closes, 200), IND_COLORS.ema200, { lineWidth: 2 });
    if (active.includes("vwap")) line(vwapLike(data), IND_COLORS.vwap, { lineStyle: LineStyle.Dotted });
    if (active.includes("bb")) {
      const b = bollinger(closes, 20, 2);
      line(b.upper, IND_COLORS.bb);
      line(b.mid, IND_COLORS.bb, { lineStyle: LineStyle.Dashed });
      line(b.lower, IND_COLORS.bb);
    }
    // Lower panes
    let top = both ? 0.6 : 0.76;
    if (active.includes("rsi")) {
      const s = line(rsi(closes, 14), "#9b59b6", { priceScaleId: "rsi", lastValueVisible: true });
      chart.priceScale("rsi").applyOptions({ scaleMargins: { top, bottom: both ? 0.21 : 0.02 } });
      s.createPriceLine({ price: 70, color: cssColor("--muted-foreground", 0.5), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
      s.createPriceLine({ price: 30, color: cssColor("--muted-foreground", 0.5), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
      top = 0.8;
    }
    if (active.includes("macd")) {
      const m = macd(closes, 12, 26, 9);
      const hist = chart.addHistogramSeries({ priceScaleId: "macd", priceLineVisible: false, lastValueVisible: false });
      hist.setData(m.hist.map((v, i) => (v == null ? { time: times[i] as Time } : { time: times[i] as Time, value: v, color: v >= 0 ? cssColor("--trading-success", 0.6) : cssColor("--trading-danger", 0.6) })));
      overlayRefs.current.push(hist);
      line(m.macd, "#3498db", { priceScaleId: "macd" });
      line(m.signal, "#e67e22", { priceScaleId: "macd" });
      chart.priceScale("macd").applyOptions({ scaleMargins: { top, bottom: 0.02 } });
    }
    if (state === "ready") chart.timeScale().scrollToRealTime();
  }, [rows, type, active, state]);

  useEffect(() => {
    if (rows.length) chartRef.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, rows.length - 120), to: rows.length + 8 });
  }, [rows]);

  // Live price moves the latest candle
  useEffect(() => {
    const series = mainRef.current;
    if (!live || !series || state === "loading") return;
    const now = Math.floor(Date.now() / 1000 / tf.seconds) * tf.seconds;
    const arr = candlesRef.current;
    const last = arr[arr.length - 1];
    if (last && (last.time as number) > now) return;
    const candle: CandlestickData =
      last && last.time === now
        ? { ...last, high: Math.max(last.high, live), low: Math.min(last.low, live), close: live }
        : { time: now as UTCTimestamp, open: last?.close ?? live, high: Math.max(last?.close ?? live, live), low: Math.min(last?.close ?? live, live), close: live };
    if (last && last.time === now) arr[arr.length - 1] = candle; else arr.push(candle);
    series.update(type === "candles" || type === "bars" ? candle : { time: candle.time, value: candle.close });
    if (state === "empty") setState("ready");
  }, [live, tf.seconds, state, type]);

  const toggle = (id: IndicatorId) => setActive((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const change = legend ? legend.close - legend.open : 0;

  return (
    <div className={`${full ? "fixed inset-0 z-50" : "w-full h-full"} flex flex-col rounded-lg border border-border bg-card animate-fade-in`}>
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-border">
        <span className="text-sm font-semibold text-foreground mr-2">{name || symbol}</span>
        {TIMEFRAMES.map((t) => (
          <Button key={t.label} size="sm" variant={t.label === tf.label ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setTf(t)}>
            {t.label}
          </Button>
        ))}
        <div className="w-px h-5 bg-border mx-1" />
        {CHART_TYPES.map(({ id, icon: Icon, label }) => (
          <Button key={id} size="icon" variant={type === id ? "secondary" : "ghost"} className="h-7 w-7" title={label} onClick={() => setType(id)}>
            <Icon className="h-4 w-4" />
          </Button>
        ))}
        <div className="w-px h-5 bg-border mx-1" />
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1">
              <Activity className="h-4 w-4" /> Indicators{active.length ? ` (${active.length})` : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-2" align="start">
            {INDICATORS.map((i) => (
              <label key={i.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                <Checkbox checked={active.includes(i.id)} onCheckedChange={() => toggle(i.id)} />
                {i.label}
              </label>
            ))}
          </PopoverContent>
        </Popover>
        <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto" title="Fullscreen" onClick={() => setFull((f) => !f)}>
          {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
      <div className="relative flex-1 min-h-[320px]">
        <div ref={containerRef} className="absolute inset-0" />
        {legend && (
          <div className="absolute left-2 top-1 z-10 text-[11px] font-mono flex flex-wrap gap-x-2 pointer-events-none text-muted-foreground">
            <span>O <b className={change >= 0 ? "text-trading-success" : "text-trading-danger"}>{fmt(legend.open)}</b></span>
            <span>H <b className={change >= 0 ? "text-trading-success" : "text-trading-danger"}>{fmt(legend.high)}</b></span>
            <span>L <b className={change >= 0 ? "text-trading-success" : "text-trading-danger"}>{fmt(legend.low)}</b></span>
            <span>C <b className={change >= 0 ? "text-trading-success" : "text-trading-danger"}>{fmt(legend.close)}</b></span>
          </div>
        )}
        {state !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
            {state === "loading" ? `Loading ${symbol} chart...` : "Chart history is being collected for this market"}
          </div>
        )}
      </div>
    </div>
  );
};
