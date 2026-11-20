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
      <h3 className="text-sm font-semibold text-foreground md:text-sm">{title}</h3>
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
  <Bento className="flex flex-col justify-between gap-3 p-4">
    <div className="flex items-center justify-between">
      <span className="label-caps">{label}</span>
      {icon && <span className="text-muted-foreground">{icon}</span>}
    </div>
    <div className={cn("num truncate text-xl font-semibold md:text-2xl", tone === "up" && "text-success", tone === "down" && "text-destructive")}>{value}</div>
    {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
  </Bento>
);

const ChartTip = ({ active, payload, label, money = true }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
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
            <span className="num text-3xl font-semibold md:text-4xl">{fmtUsd(equity)}</span>
            <Pill value={change} />
          </div>
        </div>
        <div className="flex rounded-lg border border-border bg-surface-2 p-0.5">
          {(Object.keys(RANGE_MS) as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={cn("num rounded-md px-2.5 py-1 max-md:py-2 max-md:px-3 text-xs transition-colors touch-manipulation",
                r === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{r}</button>
          ))}
        </div>
      </div>
      <div className="h-[220px] w-full md:h-[260px]">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.amber} stopOpacity={0.35} />
                <stop offset="100%" stopColor={C.amber} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={64} domain={["auto", "auto"]} tickFormatter={(v) => fmtCompact(v)} />
            <Tooltip content={<ChartTip />} cursor={{ stroke: C.amber, strokeOpacity: 0.4 }} />
            <Area type="stepAfter" dataKey="v" stroke={C.amber} strokeWidth={2} fill="url(#eqFill)" />
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
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => fmtCompact(v)} />
              <ReferenceLine y={0} stroke={C.grid} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
              <Bar dataKey="v" radius={[4, 4, 4, 4]}>
                {data.map((d, i) => <Cell key={i} fill={d.v >= 0 ? C.green : C.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState text="No closed trades in the last 14 days" />}
      </div>
    </Bento>
  );
};

export const Donut = ({ title, subtitle, data, center }: { title: string; subtitle?: string; data: { name: string; value: number }[]; center: ReactNode }) => {
  const palette = [C.amber, C.green, C.cyan, C.violet, C.red];
  const has = data.some((d) => d.value > 0);
  return (
    <Bento className="flex flex-col">
      <BentoHeader title={title} subtitle={subtitle} />
      {has ? (
        <div className="flex items-center gap-4">
          <div className="relative h-[140px] w-[140px] shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={48} outerRadius={66} paddingAngle={3} stroke="none">
                  {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">{center}</div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2 text-xs">
            {data.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 truncate text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: palette[i % palette.length] }} />{d.name}
                </span>
                <span className="num text-foreground">{d.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : <EmptyState text="Nothing to show yet" />}
    </Bento>
  );
};

export const MarginGauge = ({ level }: { level: number | null }) => {
  const pct = level === null ? 100 : Math.min(level / 1000, 1) * 100;
  const tone = level === null || level > 200 ? "bg-success" : level > 100 ? "bg-warning" : "bg-destructive";
  return (
    <div className="space-y-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground"><span>Stop-out</span><span>Safe</span></div>
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
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg",
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
