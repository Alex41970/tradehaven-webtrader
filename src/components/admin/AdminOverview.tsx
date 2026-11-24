import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, CreditCard, DollarSign, TrendingUp, Users } from "lucide-react";
import { Bento, BentoHeader, Donut, EmptyState, StatCard, fmtCompact, fmtSigned, fmtUsd } from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/button";

type U = { user_id: string; email: string; first_name?: string; surname?: string; balance: number; created_at: string };
type T = { id: string; symbol: string; status: string; opened_at: string; pnl: number; user_id: string };

interface Props {
  users: U[];
  trades: T[];
  stats: { totalBalance: number; totalCredit?: number; totalUsers: number; totalTrades: number; activeTrades: number };
  tradeStats: { netClosedPnL: number; activeTradesPnL: number; grossProfit: number; grossLoss: number };
  pendingRequests: number;
  onNavigate: (id: string) => void;
}

const grid = "hsl(var(--border))";
const muted = "hsl(var(--muted-foreground))";

const Tip = ({ active, payload, label }: any) =>
  active && payload?.length ? (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-muted-foreground">{label}</div>
      <div className="num font-medium text-foreground">{payload[0].value}</div>
    </div>
  ) : null;

const lastDays = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (n - 1 - i));
    return d;
  });

export const AdminOverview = ({ users, trades, stats, tradeStats, pendingRequests, onNavigate }: Props) => {
  const growth = useMemo(() => {
    const days = lastDays(30);
    return days.map((d) => ({
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      v: users.filter((u) => +new Date(u.created_at) < +d + 864e5).length,
    }));
  }, [users]);

  const volume = useMemo(() => {
    const days = lastDays(14);
    return days.map((d) => ({
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      v: trades.filter((t) => { const o = +new Date(t.opened_at); return o >= +d && o < +d + 864e5; }).length,
    }));
  }, [trades]);

  const topSymbols = useMemo(() => {
    const m = new Map<string, number>();
    trades.forEach((t) => m.set(t.symbol, (m.get(t.symbol) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
  }, [trades]);

  const topAccounts = useMemo(() => [...users].sort((a, b) => (b.balance || 0) - (a.balance || 0)).slice(0, 6), [users]);
  const net = tradeStats.netClosedPnL + tradeStats.activeTradesPnL;

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <StatCard label="Users" value={String(stats.totalUsers)} icon={<Users className="h-4 w-4" />} />
      <StatCard label="Client balances" value={fmtCompact(stats.totalBalance)} icon={<DollarSign className="h-4 w-4" />}
        hint={`Credit given ${fmtCompact(stats.totalCredit || 0)}`} />
      <StatCard label="Open trades" value={String(stats.activeTrades)} hint={`${stats.totalTrades} total`} icon={<Activity className="h-4 w-4" />} />
      <StatCard label="Client P&L" value={fmtSigned(net)} tone={net >= 0 ? "up" : "down"}
        hint={`Open ${fmtSigned(tradeStats.activeTradesPnL)}`} icon={<TrendingUp className="h-4 w-4" />} />

      <Bento className="col-span-2 flex flex-col lg:col-span-3">
        <BentoHeader title="Accounts" subtitle="Total registered users, last 30 days" />
        <div className="h-[220px]">
          {users.length ? (
            <ResponsiveContainer>
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="adm-g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="v" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#adm-g)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No users yet" />}
        </div>
      </Bento>

      <Bento className="col-span-2 flex flex-col justify-between lg:col-span-1">
        <BentoHeader title="Needs attention" />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground"><CreditCard className="h-4 w-4" />Pending requests</span>
            <span className="num text-xl font-semibold text-primary">{pendingRequests}</span>
          </div>
          <Button variant="outline" className="w-full" onClick={() => onNavigate("financial-requests")}>Review requests</Button>
        </div>
      </Bento>

      <Bento className="col-span-2 flex flex-col">
        <BentoHeader title="Trades opened" subtitle="Last 14 days" />
        <div className="h-[180px]">
          {trades.length ? (
            <ResponsiveContainer>
              <BarChart data={volume}>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis allowDecimals={false} tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<Tip />} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                <Bar dataKey="v" fill="hsl(var(--chart-3))" radius={[4, 4, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No trades yet" />}
        </div>
      </Bento>

      <div className="col-span-2">
        <Donut title="Most traded" subtitle="By number of trades" data={topSymbols}
          center={<><span className="num text-lg font-semibold">{stats.totalTrades}</span><span className="text-[10px] text-muted-foreground">trades</span></>} />
      </div>

      <Bento className="col-span-2 lg:col-span-4">
        <BentoHeader title="Largest accounts" right={<Button variant="ghost" size="sm" onClick={() => onNavigate("users")}>All users</Button>} />
        {topAccounts.length ? (
          <ul className="divide-y divide-border">
            {topAccounts.map((u) => (
              <li key={u.user_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate text-foreground">{[u.first_name, u.surname].filter(Boolean).join(" ") || u.email}</div>
                  <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                </div>
                <span className="num shrink-0 font-medium">{fmtUsd(u.balance || 0)}</span>
              </li>
            ))}
          </ul>
        ) : <EmptyState text="No users yet" />}
      </Bento>
    </div>
  );
};
