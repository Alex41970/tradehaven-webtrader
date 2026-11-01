import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bento, BentoHeader, StatCard, EmptyState, fmtSigned, fmtUsd } from "@/components/dashboard/widgets";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { journalStats, groupPnl, fmtDuration } from "@/utils/marketIntel";
import type { Trade } from "@/hooks/useTrades";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CAT: Record<string, string> = { crypto: "Crypto", forex: "Forex", stocks: "Stocks", indices: "Indices", commodities: "Commodities" };
const RANGES: Record<string, number> = { "7": 7, "30": 30, "90": 90, all: 0 };

const PnlBars = ({ data }: { data: { name: string; pnl: number }[] }) => (
  <div className="mt-2 h-[200px] w-full"><ResponsiveContainer>
    <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
      <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
      <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
        formatter={(v: number) => fmtSigned(v)} />
      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
        {data.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer></div>
);

export const JournalView = ({ trades, categoryOf }: { trades: Trade[]; categoryOf: (t: Trade) => string | undefined }) => {
  const [range, setRange] = useState("30");
  const closed = useMemo(() => {
    const days = RANGES[range];
    const since = days ? Date.now() - days * 864e5 : 0;
    return trades.filter((t) => t.status === "closed" && t.closed_at && new Date(t.closed_at).getTime() >= since).map((t) => ({ ...t, pnl: Number(t.pnl) || 0, category: categoryOf(t) }));
  }, [trades, range, categoryOf]);

  const s = journalStats(closed);
  const byDay = DAYS.map((d, i) => ({ name: d, pnl: closed.filter((t) => new Date(t.closed_at!).getDay() === i).reduce((a, t) => a + t.pnl, 0) }));
  const byHour = Array.from({ length: 24 }, (_, h) => ({ name: String(h).padStart(2, "0"), pnl: closed.filter((t) => new Date(t.opened_at).getHours() === h).reduce((a, t) => a + t.pnl, 0) }));
  const byCat = groupPnl(closed, (t) => CAT[t.category ?? ""] ?? "Other").sort((a, b) => b.pnl - a.pnl);
  const bySym = groupPnl(closed, (t) => t.symbol).sort((a, b) => b.pnl - a.pnl);
  const sorted = [...closed].sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">Trading journal</h1>
        <Tabs value={range} onValueChange={setRange}><TabsList className="h-8">
          <TabsTrigger value="7" className="text-xs">7D</TabsTrigger><TabsTrigger value="30" className="text-xs">30D</TabsTrigger>
          <TabsTrigger value="90" className="text-xs">90D</TabsTrigger><TabsTrigger value="all" className="text-xs">All</TabsTrigger>
        </TabsList></Tabs>
      </div>

      {closed.length === 0 ? <Bento className="p-8"><EmptyState text="No closed trades in this period yet" /></Bento> : (<>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Net P&L" value={fmtSigned(s.net)} tone={s.net >= 0 ? "up" : "down"} hint={`${s.count} trades`} />
          <StatCard label="Profit factor" value={s.profitFactor === null ? "∞" : s.profitFactor.toFixed(2)} hint="Gross wins ÷ gross losses" />
          <StatCard label="Win rate" value={`${s.winRate.toFixed(1)}%`} hint={`${s.wins} W / ${s.losses} L`} />
          <StatCard label="Avg hold time" value={fmtDuration(s.avgHoldMs)} />
          <StatCard label="Avg win" value={fmtUsd(s.avgWin)} tone="up" />
          <StatCard label="Avg loss" value={fmtUsd(s.avgLoss)} tone="down" />
          <StatCard label="Win/loss ratio" value={s.winLossRatio === null ? "—" : s.winLossRatio.toFixed(2)} hint="Avg win ÷ avg loss" />
          <StatCard label="Best asset class" value={byCat[0]?.name ?? "—"} hint={byCat[0] ? fmtSigned(byCat[0].pnl) : undefined} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Bento className="p-4"><BentoHeader title="P&L by day of week" subtitle="By close date" /><PnlBars data={byDay} /></Bento>
          <Bento className="p-4"><BentoHeader title="P&L by hour opened" subtitle="Your local time" /><PnlBars data={byHour} /></Bento>
          <Bento className="p-4"><BentoHeader title="P&L by asset class" /><PnlBars data={byCat} /></Bento>
          <Bento className="p-4">
            <BentoHeader title="Markets" subtitle={`Best ${bySym[0]?.name ?? "—"} · Worst ${bySym[bySym.length - 1]?.name ?? "—"}`} />
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
              {[["Best trades", sorted.slice(0, 5)], ["Worst trades", sorted.slice(-5).reverse()]].map(([title, list]) => (
                <div key={title as string}>
                  <div className="label-caps mb-1.5">{title as string}</div>
                  {(list as typeof sorted).map((t) => (
                    <div key={t.id} className="flex justify-between border-b border-border py-1.5 last:border-0">
                      <span>{t.trade_type} {t.symbol}</span>
                      <span className={`num ${t.pnl >= 0 ? "text-success" : "text-destructive"}`}>{fmtSigned(t.pnl)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Bento>
        </div>
      </>)}
    </div>
  );
};
