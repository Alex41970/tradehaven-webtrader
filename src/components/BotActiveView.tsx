import React, { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, Pause, Play, Power, Bot, Shield, Bell, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTrades, type Trade } from "@/hooks/useTrades";
import { useBotStatus } from "@/hooks/useBotStatus";
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "@/hooks/use-toast";
import { Bento, BentoHeader, EmptyState, StatCard, fmtUsd, fmtSigned } from "@/components/dashboard/widgets";
import { cn } from "@/lib/utils";

interface BotActiveViewProps {
  botStatus: "active" | "paused";
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onBackToDashboard: () => void;
}

const DEFAULTS = {
  maxDrawdown: 10, dailyLossLimit: 1000, maxOpenPositions: 3, riskLevel: "moderate",
  autoTakeProfit: 5, autoStopLoss: 2, trailingStopEnabled: false, trailingStopPercent: 1.5,
  maxTradesPerDay: 10, minTimeBetweenTrades: 15,
  notifyTradeOpened: false, notifyTradeClosed: false, notifyProfitLoss: false,
};
type Settings = typeof DEFAULTS;

const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-0">
    <div className="min-w-0">
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const SliderRow = ({ label, hint, value, min, max, step, onChange }: { label: string; hint?: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) => (
  <div className="space-y-2 border-b border-border/60 py-3 last:border-0">
    <div className="flex items-center justify-between">
      <Label className="text-sm font-medium">{label}</Label>
      <span className="num text-sm font-semibold text-primary">{value}%</span>
    </div>
    <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

export const BotActiveView: React.FC<BotActiveViewProps> = ({ botStatus, onPause, onResume, onDelete, onBackToDashboard }) => {
  const { botTrades, openBotTrades, closedBotTrades } = useTrades();
  const { updateBotSettings } = useBotStatus();
  const { requestPermission } = useNotifications();
  const [s, setS] = useState<Settings>(DEFAULTS);
  const running = botStatus === "active";

  const set = (k: keyof Settings, v: any) => {
    const next = { ...s, [k]: v };
    setS(next);
    updateBotSettings?.(next as any);
  };
  const setNotify = async (k: keyof Settings, on: boolean) => {
    if (on && typeof Notification !== "undefined" && !(await requestPermission())) {
      toast({ title: "Notifications blocked", description: "Allow notifications in your browser to get bot alerts.", variant: "destructive" });
      return;
    }
    set(k, on);
  };

  const stats = useMemo(() => {
    const closed = closedBotTrades as Trade[];
    const total = closed.reduce((a, t) => a + (t.pnl || 0), 0);
    const wins = closed.filter((t) => t.pnl > 0).length;
    const pnls = closed.map((t) => t.pnl || 0);
    const sorted = [...closed].sort((a, b) => new Date(a.closed_at || a.updated_at).getTime() - new Date(b.closed_at || b.updated_at).getTime());
    let run = 0;
    const curve = sorted.map((t) => {
      run += t.pnl || 0;
      return { t: new Date(t.closed_at || t.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }), v: run };
    });
    return {
      total, wins, losses: closed.length - wins,
      winRate: closed.length ? (wins / closed.length) * 100 : 0,
      best: pnls.length ? Math.max(...pnls) : 0,
      worst: pnls.length ? Math.min(...pnls) : 0,
      curve,
    };
  }, [closedBotTrades]);

  const recent = useMemo(
    () => [...(botTrades as Trade[])].sort((a, b) => new Date(b.closed_at || b.opened_at).getTime() - new Date(a.closed_at || a.opened_at).getTime()).slice(0, 12),
    [botTrades],
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] min-w-0 space-y-4">
      {/* Header */}
      <Bento className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <Bot className="h-6 w-6" />
            <span className={cn("absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-card", running ? "bg-success" : "bg-muted-foreground")} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold md:text-2xl">Trading Bot</h1>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                running ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground")}>
                <span className={cn("h-1.5 w-1.5 rounded-full", running ? "animate-pulse bg-success" : "bg-muted-foreground")} />
                {running ? "Running" : "Paused"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{running ? "Placing trades automatically with your rules below." : "Not opening new trades. Open positions stay open."}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={onBackToDashboard}><ArrowLeft className="mr-1.5 h-4 w-4" />Overview</Button>
          {running
            ? <Button variant="outline" size="sm" onClick={onPause}><Pause className="mr-1.5 h-4 w-4" />Pause</Button>
            : <Button size="sm" onClick={onResume}><Play className="mr-1.5 h-4 w-4" />Resume</Button>}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Power className="mr-1.5 h-4 w-4" />Disconnect</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect the bot?</AlertDialogTitle>
                <AlertDialogDescription>This removes the bot licence from your account. You'll need a licence key to turn it on again.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Disconnect</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Bento>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Bot P&L" value={fmtSigned(stats.total)} tone={stats.total >= 0 ? "up" : "down"} hint={`${closedBotTrades.length} closed trades`} />
        <StatCard label="Win rate" value={`${stats.winRate.toFixed(1)}%`} hint={`${stats.wins} wins · ${stats.losses} losses`} />
        <StatCard label="Open positions" value={String(openBotTrades.length)} hint={`Limit ${s.maxOpenPositions}`} />
        <StatCard label="Best / worst" value={fmtUsd(stats.best)} tone="up" hint={<span className="num text-destructive">{fmtUsd(stats.worst)}</span>} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Left: chart + activity */}
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <Bento>
            <BentoHeader title="Cumulative P&L" subtitle="Running total of closed bot trades" />
            <div className="h-64">
              {stats.curve.length < 2 ? <EmptyState text="The chart appears after the bot closes a couple of trades." /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.curve} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="botPnl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="t" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => fmtUsd(v, 0)} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [fmtUsd(v), "P&L"]} />
                    <Area type="monotone" dataKey="v" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#botPnl)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Bento>

          <Bento>
            <BentoHeader title="Recent bot activity" subtitle="Trades the bot opened and closed" />
            {recent.length === 0 ? <EmptyState text="No bot trades yet." /> : (
              <div className="divide-y divide-border/60">
                {recent.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", t.trade_type === "BUY" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>{t.trade_type}</span>
                      <span className="truncate font-medium">{t.symbol}</span>
                      <span className="num hidden text-xs text-muted-foreground sm:inline">{t.amount} lot</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="hidden text-xs text-muted-foreground sm:inline">{t.status === "open" ? "Open" : "Closed"} · {new Date(t.closed_at || t.opened_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      <span className={cn("num w-24 text-right font-medium", t.status === "open" ? "text-muted-foreground" : t.pnl >= 0 ? "text-success" : "text-destructive")}>
                        {t.status === "open" ? "running" : fmtSigned(t.pnl)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Bento>
        </div>

        {/* Right: settings */}
        <Bento className="min-w-0">
          <BentoHeader title="Bot rules" subtitle="Changes save automatically" />
          <Tabs defaultValue="risk">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="risk"><Shield className="mr-1.5 h-3.5 w-3.5" />Risk</TabsTrigger>
              <TabsTrigger value="trades"><SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />Trades</TabsTrigger>
              <TabsTrigger value="alerts"><Bell className="mr-1.5 h-3.5 w-3.5" />Alerts</TabsTrigger>
            </TabsList>

            <TabsContent value="risk" className="mt-2">
              <SliderRow label="Max drawdown" hint="Bot pauses at this loss" value={s.maxDrawdown} min={5} max={50} step={5} onChange={(v) => set("maxDrawdown", v)} />
              <Row label="Daily loss limit" hint="In USD">
                <Input type="number" className="num h-8 w-28" value={s.dailyLossLimit} min={100} step={100} onChange={(e) => set("dailyLossLimit", Number(e.target.value))} />
              </Row>
              <Row label="Max open positions">
                <Input type="number" className="num h-8 w-20" value={s.maxOpenPositions} min={1} max={10} onChange={(e) => set("maxOpenPositions", Number(e.target.value))} />
              </Row>
              <Row label="Risk level">
                <Select value={s.riskLevel} onValueChange={(v) => set("riskLevel", v)}>
                  <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                    <SelectItem value="very_aggressive">Very aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
            </TabsContent>

            <TabsContent value="trades" className="mt-2">
              <SliderRow label="Take profit" hint="Default target for new trades" value={s.autoTakeProfit} min={1} max={20} step={0.5} onChange={(v) => set("autoTakeProfit", v)} />
              <SliderRow label="Stop loss" hint="Default loss limit for new trades" value={s.autoStopLoss} min={0.5} max={10} step={0.5} onChange={(v) => set("autoStopLoss", v)} />
              <Row label="Trailing stop" hint={s.trailingStopEnabled ? "Distance from peak (%)" : undefined}>
                <div className="flex items-center gap-2">
                  {s.trailingStopEnabled && <Input type="number" className="num h-8 w-20" value={s.trailingStopPercent} min={0.5} max={5} step={0.1} onChange={(e) => set("trailingStopPercent", Number(e.target.value))} />}
                  <Switch checked={s.trailingStopEnabled} onCheckedChange={(v) => set("trailingStopEnabled", v)} />
                </div>
              </Row>
              <Row label="Max trades per day">
                <Input type="number" className="num h-8 w-20" value={s.maxTradesPerDay} min={1} max={50} onChange={(e) => set("maxTradesPerDay", Number(e.target.value))} />
              </Row>
              <Row label="Wait between trades">
                <Select value={String(s.minTimeBetweenTrades)} onValueChange={(v) => set("minTimeBetweenTrades", Number(v))}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">None</SelectItem>
                    <SelectItem value="5">5 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
            </TabsContent>

            <TabsContent value="alerts" className="mt-2">
              <Row label="Trade opened"><Switch checked={s.notifyTradeOpened} onCheckedChange={(v) => setNotify("notifyTradeOpened", v)} /></Row>
              <Row label="Trade closed"><Switch checked={s.notifyTradeClosed} onCheckedChange={(v) => setNotify("notifyTradeClosed", v)} /></Row>
              <Row label="Profit / loss alerts"><Switch checked={s.notifyProfitLoss} onCheckedChange={(v) => setNotify("notifyProfitLoss", v)} /></Row>
            </TabsContent>
          </Tabs>
        </Bento>
      </div>
    </div>
  );
};
