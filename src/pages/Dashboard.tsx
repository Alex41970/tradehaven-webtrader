import { useCallback, useMemo, useState } from "react";
import { PriceAlertsProvider } from "@/hooks/usePriceAlerts";
import { MarketsView } from "@/components/intel/MarketsView";
import { JournalView } from "@/components/intel/JournalView";
import { Flame, NotebookPen } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WebTrader } from "@/components/WebTrader";
import { Portfolio } from "@/components/Portfolio";
import { TradingHistory } from "@/components/TradingHistory";
import { TradingBotModal } from "@/components/TradingBotModal";
import { BotActiveView } from "@/components/BotActiveView";
import { DepositModal } from "@/components/DepositModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import { TransactionHistoryPopup } from "@/components/TransactionHistoryPopup";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { ContactSupportModal } from "@/components/ContactSupportModal";
import { MarginCallWarning } from "@/components/MarginCallWarning";
import { AppShell, NavItem } from "@/components/layout/AppShell";
import {
  Bento, BentoHeader, StatCard, EquityChart, DailyPnlChart, Donut, MarginGauge, ActivityList, EmptyState, Pill,
  fmtUsd, fmtSigned, useEquityCurve,
} from "@/components/dashboard/widgets";
import {
  LayoutGrid, CandlestickChart, Briefcase, History, Wallet, Plus, Minus, Bot, MessageCircle, Activity, ArrowRight, Gauge, Coins, ShieldCheck,
} from "lucide-react";
import { useSharedUserProfile } from "@/hooks/useSharedUserProfile";
import { useTrades } from "@/hooks/useTrades";
import { useAssets } from "@/hooks/useAssets";
import { useRealTimePrices } from "@/hooks/useRealTimePrices";
import { useRealtimePnL } from "@/hooks/useRealtimePnL";
import { useProfessionalMetrics } from "@/hooks/usePerformanceMetrics";
import { useBotStatus } from "@/hooks/useBotStatus";
import { useTransactionHistory, TransactionHistory } from "@/hooks/useTransactionHistory";
import { useRealtimeAccountMetrics } from "@/hooks/useRealtimeAccountMetrics";
import { cn } from "@/lib/utils";

type View = "overview" | "trade" | "markets" | "portfolio" | "history" | "journal" | "bot";

const CATEGORY_LABEL: Record<string, string> = {
  crypto: "Crypto", forex: "Forex", stock: "Stocks", stocks: "Stocks", index: "Indices", indices: "Indices", commodity: "Commodities", commodities: "Commodities",
};

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = (params.get("view") as View) || "overview";
  const setView = (v: string) => setParams(v === "overview" ? {} : { view: v });

  const { trades, openTrades } = useTrades();
  const { profile, loading: profileLoading } = useSharedUserProfile(openTrades.length > 0);
  const { assets, loading: assetsLoading } = useAssets();
  const { getUpdatedAssets } = useRealTimePrices();
  const { botStatus, activateLicense, pauseBot, resumeBot, disconnectBot } = useBotStatus();
  const { realTimeBalance, realTimeEquity, realTimeFreeMargin, totalUsedMargin } = useRealtimeAccountMetrics();
  const { metrics } = useProfessionalMetrics(trades, realTimeEquity);
  const { transactionHistory } = useTransactionHistory();

  const updatedAssets = useMemo(() => getUpdatedAssets(assets), [assets, getUpdatedAssets]);
  const { tradePnL, totalPnL } = useRealtimePnL(trades, updatedAssets);
  const equityCurve = useEquityCurve(realTimeBalance, realTimeEquity, trades, transactionHistory);

  const [botModalOpen, setBotModalOpen] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showBotFullScreen, setShowBotFullScreen] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TransactionHistory | null>(null);
  const [showSupport, setShowSupport] = useState(false);

  const marginLevel = totalUsedMargin > 0 ? (realTimeEquity / totalUsedMargin) * 100 : null;
  const firstPoint = equityCurve.find((p) => p.t >= Date.now() - 30 * 864e5) ?? equityCurve[0];
  const monthChange = firstPoint && firstPoint.v > 0 ? ((realTimeEquity - firstPoint.v) / firstPoint.v) * 100 : 0;

  const exposure = useMemo(() => {
    const map = new Map<string, number>();
    openTrades.forEach((t) => {
      const a = assets.find((x) => x.id === t.asset_id || x.symbol === t.symbol);
      const k = CATEGORY_LABEL[a?.category ?? ""] ?? "Other";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return [...map].map(([name, value]) => ({ name, value }));
  }, [openTrades, assets]);

  const movers = useMemo(() =>
    [...updatedAssets].filter((a) => a.is_active && Number.isFinite(a.change_24h))
      .sort((a, b) => Math.abs(b.change_24h) - Math.abs(a.change_24h)).slice(0, 6), [updatedAssets]);

  const categoryOf = useCallback((t: { asset_id: string; symbol: string }) =>
    assets.find((x) => x.id === t.asset_id || x.symbol === t.symbol)?.category, [assets]);

  const nav: NavItem[] = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "trade", label: "Trade", icon: CandlestickChart },
    { id: "markets", label: "Markets", icon: Flame },
    { id: "portfolio", label: "Positions", icon: Briefcase },
    { id: "history", label: "History", icon: History },
    { id: "journal", label: "Journal", icon: NotebookPen },
    { id: "wallet", label: "Deposit", icon: Wallet, onClick: () => setShowDeposit(true) },
    { id: "bot", label: "Trading Bot", icon: Bot, onClick: botStatus.isConnected ? undefined : () => setBotModalOpen(true) },
  ];

  const name = profile?.first_name ? `${profile.first_name}${profile.surname ? " " + profile.surname : ""}` : user?.email?.split("@")[0];
  const loading = profileLoading || assetsLoading;

  const topbar = (
    <div className="flex w-full items-center gap-4">
      <div className="hidden min-w-0 items-center gap-6 lg:flex">
        {[
          ["Balance", fmtUsd(realTimeBalance)],
          ["Equity", fmtUsd(realTimeEquity)],
          ["Free margin", fmtUsd(realTimeFreeMargin)],
          ["Margin level", marginLevel === null ? "—" : marginLevel > 9999 ? ">9999%" : `${marginLevel.toFixed(0)}%`],
        ].map(([l, v]) => (
          <div key={l} className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
            <div className="num truncate text-sm font-medium">{v}</div>
          </div>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ConnectionStatus />
        <Button size="icon" variant="ghost" onClick={() => setShowSupport(true)} aria-label="Support"><MessageCircle className="h-4 w-4" /></Button>
        <Button size="sm" onClick={() => setShowDeposit(true)}><Plus className="mr-1 h-4 w-4" />Deposit</Button>
      </div>
    </div>
  );

  return (
    <PriceAlertsProvider>
    <AppShell nav={nav} active={view} onNavigate={setView} topbar={topbar} onSignOut={() => signOut()}
      dense={view === "trade"} autoCollapse={view === "trade"}
      footer={<div className="rounded-xl border border-border bg-surface-2 p-3 text-xs">
        <div className="truncate font-medium">{name}</div>
        <div className="mt-0.5 flex items-center gap-1 text-muted-foreground"><ShieldCheck className="h-3 w-3 text-primary" />ID {user?.id?.slice(-8).toUpperCase()}</div>
      </div>}>
      {realTimeEquity > 0 && totalUsedMargin > 0 && (
        <MarginCallWarning equity={realTimeEquity} usedMargin={totalUsedMargin} className="mb-4" />
      )}

      {view === "trade" && <WebTrader initialSymbol={params.get("symbol") ?? undefined} />}
      {view === "markets" && <MarketsView assets={updatedAssets} onOpen={(s) => setParams({ view: "trade", symbol: s })} />}
      {view === "journal" && <JournalView trades={trades} categoryOf={categoryOf} />}
      {view === "portfolio" && <Bento className="p-0 md:p-2"><Portfolio /></Bento>}
      {view === "history" && <Bento className="p-0 md:p-2"><TradingHistory /></Bento>}
      {view === "bot" && botStatus.isConnected && (
        <BotActiveView botStatus={botStatus.botStatus} onPause={pauseBot} onResume={resumeBot}
          onDelete={() => { disconnectBot(); setView("overview"); }} onBackToDashboard={() => setView("overview")} />
      )}

      {view === "overview" && (
        loading ? (
          <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className={cn("h-32 rounded-2xl", i === 0 && "md:col-span-3 md:row-span-2 md:h-auto")} />)}</div>
        ) : (
          <div className="mx-auto max-w-[1500px] space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Welcome back</p>
                <h1 className="text-2xl font-semibold md:text-3xl lg:text-3xl">{name}</h1>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowWithdraw(true)}><Minus className="mr-1 h-4 w-4" />Withdraw</Button>
                <Button size="sm" onClick={() => setView("trade")}>Start trading<ArrowRight className="ml-1 h-4 w-4" /></Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="col-span-2 lg:col-span-3 lg:row-span-2">
                <EquityChart points={equityCurve} equity={realTimeEquity} change={monthChange} />
              </div>
              <StatCard label="Balance" value={fmtUsd(realTimeBalance)} icon={<Coins className="h-4 w-4" />} hint="Settled cash" />
              <StatCard label="Open P&L" value={fmtSigned(totalPnL || 0)} tone={(totalPnL || 0) >= 0 ? "up" : "down"}
                icon={<Activity className="h-4 w-4" />} hint={`${openTrades.length} open position${openTrades.length === 1 ? "" : "s"}`} />
              <StatCard label="Free margin" value={fmtUsd(realTimeFreeMargin)} hint={`Used ${fmtUsd(totalUsedMargin)}`} />
              <Bento className="flex flex-col justify-between gap-3 p-4">
                <div className="flex items-center justify-between"><span className="label-caps">Margin level</span><Gauge className="h-4 w-4 text-muted-foreground" /></div>
                <div className="num text-xl font-semibold md:text-2xl">{marginLevel === null ? "No exposure" : marginLevel > 9999 ? ">9999%" : `${marginLevel.toFixed(0)}%`}</div>
                <MarginGauge level={marginLevel} />
              </Bento>
              <StatCard label="Win rate" value={`${metrics.winRate.toFixed(1)}%`} hint={`${metrics.profitableTrades}W · ${metrics.losingTrades}L`} />
              <StatCard label="Profit factor" value={metrics.profitFactor.toFixed(2)} hint={`Max drawdown ${metrics.maximumDrawdownPercent.toFixed(1)}%`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2"><DailyPnlChart trades={trades} /></div>
              <Donut title="Exposure" subtitle="Open positions by market" data={exposure}
                center={<><span className="num text-xl font-semibold">{openTrades.length}</span><span className="text-[10px] text-muted-foreground">open</span></>} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Bento className="lg:col-span-2">
                <BentoHeader title="Open positions" subtitle="Live profit and loss"
                  right={<Button variant="ghost" size="sm" onClick={() => setView("portfolio")}>View all<ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>} />
                {openTrades.length === 0 ? <EmptyState text="No open positions. Open one from the Trade tab." /> : (
                  <div className="-mx-2 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-2 pb-2 font-medium">Market</th><th className="px-2 pb-2 font-medium">Side</th>
                        <th className="px-2 pb-2 text-right font-medium">Lots</th><th className="px-2 pb-2 text-right font-medium">Open</th>
                        <th className="px-2 pb-2 text-right font-medium">P&L</th>
                      </tr></thead>
                      <tbody>
                        {openTrades.slice(0, 6).map((t) => {
                          const p = tradePnL[t.id] ?? t.pnl ?? 0;
                          return (
                            <tr key={t.id} className="border-t border-border/60">
                              <td className="px-2 py-2.5 font-medium">{t.symbol}</td>
                              <td className="px-2 py-2.5"><span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                                t.trade_type === "BUY" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>{t.trade_type}</span></td>
                              <td className="num px-2 py-2.5 text-right">{t.amount}</td>
                              <td className="num px-2 py-2.5 text-right text-muted-foreground">{Number(t.open_price).toLocaleString(undefined, { maximumFractionDigits: 5 })}</td>
                              <td className={cn("num px-2 py-2.5 text-right font-medium", p >= 0 ? "text-success" : "text-destructive")}>{fmtSigned(p)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Bento>
              <Bento>
                <BentoHeader title="Top movers" subtitle="Biggest 24h moves" />
                {movers.length === 0 ? <EmptyState text="Waiting for prices" /> : (
                  <ul className="space-y-1">
                    {movers.map((a) => (
                      <li key={a.id}>
                        <button onClick={() => setView("trade")} className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-lg px-2 py-2 hover:bg-muted/60">
                          <span className="min-w-0 text-left">
                            <span className="block text-sm font-medium">{a.symbol}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{a.name}</span>
                          </span>
                          <span className="text-right">
                            <span className="num block text-sm">{Number(a.price).toLocaleString(undefined, { maximumFractionDigits: a.price < 10 ? 5 : 2 })}</span>
                            <Pill value={a.change_24h} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Bento>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <ActivityList items={transactionHistory} onClick={setSelectedTx} />
              <Donut title="Results" subtitle="Closed trades" center={<><span className="num text-xl font-semibold">{metrics.winRate.toFixed(0)}%</span><span className="text-[10px] text-muted-foreground">win rate</span></>}
                data={[{ name: "Winning", value: metrics.profitableTrades }, { name: "Losing", value: metrics.losingTrades }]} />
              <Bento className="relative overflow-hidden">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
                <BentoHeader title="Performance" subtitle="All closed trades" />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  {[
                    ["Total trades", String(metrics.totalTrades)],
                    ["Largest win", fmtUsd(metrics.largestWin)],
                    ["Largest loss", fmtUsd(Math.abs(metrics.largestLoss))],
                    ["Expectancy", fmtUsd(metrics.expectancy)],
                    ["Sharpe ratio", metrics.sharpeRatio.toFixed(2)],
                    ["Recovery", metrics.recoveryFactor.toFixed(2)],
                  ].map(([k, v]) => (
                    <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="num mt-0.5 text-sm font-medium">{v}</dd></div>
                  ))}
                </dl>
              </Bento>
            </div>
          </div>
        )
      )}

      <TradingBotModal isOpen={botModalOpen} onClose={() => setBotModalOpen(false)}
        onActivate={async (k: string) => { const ok = await activateLicense(k); if (ok) { setBotModalOpen(false); setShowPermissions(true); } return ok; }}
        onAcceptPermissions={() => setShowPermissions(false)} showPermissions={showPermissions} />
      <DepositModal open={showDeposit} onOpenChange={setShowDeposit} />
      <WithdrawModal open={showWithdraw} onOpenChange={setShowWithdraw} />
      <TransactionHistoryPopup transaction={selectedTx} isOpen={!!selectedTx} onClose={() => setSelectedTx(null)} />
      <ContactSupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />
    </AppShell>
    </PriceAlertsProvider>
  );
};

export default Dashboard;
