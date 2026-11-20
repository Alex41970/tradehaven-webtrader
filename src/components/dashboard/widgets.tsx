import { ReactNode, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import type { Trade } from "@/hooks/useTrades";
import type { TransactionHistory } from "@/hooks/useTransactionHistory";
import { ArrowDownLeft, ArrowUpRight, Inbox } from "lucide-react";

export const fmtUsd = (n: number, digits = 2) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number.isFinite(n) ? n : 0);
export const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(n || 0);
export const fmtSigned = (n: number) => `${n >= 0 ? "+" : "−"}${fmtUsd(Math.abs(n))}`;

const C = {
  amber: "hsl(var(--chart-1))",
  green: "hsl(var(--chart-2))",
  cyan: "hsl(var(--chart-3))",
  red: "hsl(var(--chart-4))",
  violet: "hsl(var(--chart-5))",
  grid: "hsl(var(--border))",
  muted: "hsl(var(--muted-foreground))",
};

export const Bento = ({ className, children }: { className?: string; children: ReactNode }) => (
  <section className={cn("bento min-w-0 p-5", className)}>{children}</section>
);

export const BentoHeader = ({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) => (
  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      <h3 className="font-sans text-[13px] font-medium tracking-normal text-foreground md:text-[13px]">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
    {right && <div className="-mx-1 max-w-full overflow-x-auto px-1">{right}</div>}
  </div>
);

export const EmptyState = ({ text }: { text: string }) => (
  <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
    <Inbox className="h-5 w-5 opacity-60" />
    {text}
  </div>
);

export const Pill = ({ value, suffix = "%" }: { value: number; suffix?: string }) => (
  <span className={cn("num inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium",
    value >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
    {value >= 0 ? "+" : ""}{value.toFixed(2)}{suffix}
  </span>
);

export const StatCard = ({ label, value, hint, icon, tone }: { label: string; value: string; hint?: ReactNode; icon?: ReactNode; tone?: "up" | "down" }) => (
  <Bento className="flex flex-col justify-between gap-2 p-4">
    <div className="flex items-center justify-between">
      <span className="label-caps">{label}</span>
    </div>
    <div className={cn("num truncate text-lg font-medium md:text-xl", tone === "up" && "text-success", tone === "down" && "text-destructive")}>{value}</div>
    {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
  </Bento>
);

const ChartTip = ({ active, payload, label, money = true }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-border bg-popover px-2.5 py-1.5 text-[11px]">
      <div className="mb-1 text-muted-foreground">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="num font-medium text-foreground">{money ? fmtUsd(p.value) : p.value}</div>
      ))}
    </div>
  );
};

type Range = "1W" | "1M" | "3M" | "ALL";
const RANGE_MS: Record<Range, number> = { "1W": 7 * 864e5, "1M": 30 * 864e5, "3M": 90 * 864e5, ALL: Infinity };

/** Rebuilds balance history backwards from the current balance using closed trades and approved cash moves. */
export function useEquityCurve(balance: number, equity: number, trades: Trade[], txs: TransactionHistory[]) {
  return useMemo(() => {
    const events: { t: number; delta: number }[] = [];
    trades.filter((t) => t.status === "closed" && t.closed_at).forEach((t) => events.push({ t: +new Date(t.closed_at!), delta: Number(t.pnl) || 0 }));
    txs.filter((x) => x.status === "approved").forEach((x) =>
      events.push({ t: +new Date(x.processed_at || x.created_at), delta: x.type === "deposit" ? x.amount : -x.amount }));
    events.sort((a, b) => b.t - a.t);
    const pts: { t: number; v: number }[] = [{ t: Date.now(), v: equity || balance }];
    let running = balance;
    for (const e of events) {
      pts.push({ t: e.t, v: running });
      running -= e.delta;
      pts.push({ t: e.t - 1, v: running });
    }
    if (pts.length === 1) pts.push({ t: Date.now() - 30 * 864e5, v: balance });
    return pts.reverse();
  }, [balance, equity, trades, txs]);
}

export const EquityChart = ({ points, equity, change }: { points: { t: number; v: number }[]; equity: number; change: number }) => {
  const [range, setRange] = useState<Range>("1M");
  const data = useMemo(() => {
    const from = Date.now() - RANGE_MS[range];
    const inRange = points.filter((p) => p.t >= from);
    const before = points.filter((p) => p.t < from).pop();
    const list = before ? [{ t: from, v: before.v }, ...inRange] : inRange;
    return list.map((p) => ({ label: new Date(p.t).toLocaleDateString(undefined, { month: "short", day: "numeric" }), v: Math.round(p.v * 100) / 100 }));
  }, [points, range]);

  return (
    <Bento className="flex flex-col">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="label-caps">Total equity</span>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="num text-2xl font-medium md:text-3xl">{fmtUsd(equity)}</span>
            <Pill value={change} />
          </div>
        </div>
        <div className="flex rounded border border-border p-0.5">
          {(Object.keys(RANGE_MS) as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={cn("num rounded-sm px-2.5 py-1 max-md:py-2 max-md:px-3 text-xs transition-colors touch-manipulation",
                r === range ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>{r}</button>
          ))}
        </div>
      </div>
      <div className="h-[220px] w-full md:h-[260px]">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.amber} stopOpacity={0.12} />
                <stop offset="100%" stopColor={C.amber} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.grid} strokeOpacity={0.6} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={64} domain={["auto", "auto"]} tickFormatter={(v) => fmtCompact(v)} />
            <Tooltip content={<ChartTip />} cursor={{ stroke: C.muted, strokeDasharray: "3 3" }} />
            <Area type="stepAfter" dataKey="v" stroke={C.amber} strokeWidth={1.5} fill="url(#eqFill)" activeDot={{ r: 3, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Bento>
  );
};

export const DailyPnlChart = ({ trades }: { trades: Trade[] }) => {
  const data = useMemo(() => {
    const days: { label: string; v: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = +d + 864e5;
      const v = trades.filter((t) => t.status === "closed" && t.closed_at && +new Date(t.closed_at) >= +d && +new Date(t.closed_at) < next)
        .reduce((s, t) => s + (Number(t.pnl) || 0), 0);
      days.push({ label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), v: Math.round(v * 100) / 100 });
    }
    return days;
  }, [trades]);
  const has = data.some((d) => d.v !== 0);
  return (
    <Bento className="flex flex-col">
      <BentoHeader title="Daily P&L" subtitle="Closed trades, last 14 days" />
      <div className="h-[180px]">
        {has ? (
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid stroke={C.grid} strokeOpacity={0.6} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => fmtCompact(v)} />
              <ReferenceLine y={0} stroke={C.grid} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
              <Bar dataKey="v" radius={[1, 1, 1, 1]} maxBarSize={18}>
                {data.map((d, i) => <Cell key={i} fill={d.v >= 0 ? C.green : C.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState text="No closed trades in the last 14 days" />}
      </div>
    </Bento>
  );
};

/** Exposure by market as horizontal share bars (replaces the old donut). */
export const Donut = ({ title, subtitle, data }: { title: string; subtitle?: string; data: { name: string; value: number }[]; center?: ReactNode }) => {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  const rows = [...data].filter((d) => d.value > 0).sort((x, y) => y.value - x.value).slice(0, 6);
  return (
    <Bento className="flex flex-col">
      <BentoHeader title={title} subtitle={subtitle} right={total > 0 ? <span className="num text-xs text-muted-foreground">{total} total</span> : undefined} />
      {rows.length ? (
        <ul className="space-y-3 text-xs">
          {rows.map((d) => {
            const pct = (d.value / total) * 100;
            return (
              <li key={d.name}>
                <div className="mb-1 flex justify-between gap-2"><span className="truncate text-foreground">{d.name}</span><span className="num text-muted-foreground">{d.value} · {pct.toFixed(0)}%</span></div>
                <div className="h-1 w-full rounded-sm bg-muted"><div className="h-full rounded-sm bg-primary" style={{ width: `${pct}%` }} /></div>
              </li>
            );
          })}
        </ul>
      ) : <EmptyState text="No open positions" />}
    </Bento>
  );
};

export const MarginGauge = ({ level }: { level: number | null }) => {
  const max = 500;
  const pct = level === null ? 100 : Math.min(level / max, 1) * 100;
  const tone = level === null || level > 200 ? "bg-success" : level > 100 ? "bg-warning" : "bg-destructive";
  return (
    <div className="space-y-1">
      <div className="relative h-1.5 w-full rounded-sm bg-muted">
        <div className={cn("h-full rounded-sm transition-all", tone)} style={{ width: `${pct}%` }} />
        <span className="absolute -top-0.5 h-2.5 w-px bg-destructive" style={{ left: `${(50 / max) * 100}%` }} />
        <span className="absolute -top-0.5 h-2.5 w-px bg-warning" style={{ left: `${(100 / max) * 100}%` }} />
      </div>
      <div className="relative h-3 text-[10px] text-muted-foreground">
        <span className="absolute -translate-x-1/2" style={{ left: `${(100 / max) * 100}%` }}>Call 100</span>
        <span className="absolute right-0">500%+</span>
      </div>
    </div>
  );
};

export const ActivityList = ({ items, onClick }: { items: TransactionHistory[]; onClick: (t: TransactionHistory) => void }) => (
  <Bento className="flex flex-col">
    <BentoHeader title="Wallet activity" subtitle="Deposits and withdrawals" />
    {items.length === 0 ? <EmptyState text="No deposits or withdrawals yet" /> : (
      <ul className="-mx-2 space-y-1">
        {items.slice(0, 6).map((t) => (
          <li key={t.id}>
            <button onClick={() => onClick(t)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60">
              <span className={cn("flex h-7 w-7 items-center justify-center rounded",
                t.type === "deposit" ? "bg-success/10 text-success" : "bg-chart-3/10 text-chart-3")}>
                {t.type === "deposit" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm capitalize">{t.type}</span>
                <span className="block text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</span>
              </span>
              <span className="text-right">
                <span className="num block text-sm">{fmtUsd(t.amount)}</span>
                <span className={cn("text-[11px] capitalize",
                  t.status === "approved" ? "text-success" : t.status === "rejected" ? "text-destructive" : "text-warning")}>{t.status}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    )}
  </Bento>
);
