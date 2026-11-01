// Pure helpers for sentiment, price alerts and the trading journal.

export type AlertDirection = "above" | "below";

/** True when price moved from one side of the target to the other (or touched it) in the alert's direction. */
export function alertCrossed(direction: AlertDirection, target: number, prev: number | undefined, current: number): boolean {
  if (!(current > 0) || !(target > 0)) return false;
  if (prev === undefined || !(prev > 0)) {
    return direction === "above" ? current >= target : current <= target;
  }
  return direction === "above" ? prev < target && current >= target : prev > target && current <= target;
}

/** Market-mood estimate (0-100 % bullish) from real 24h change. Neutral at 0%, saturates smoothly. */
export function estimateBullish(change24h: number, category?: string): number {
  const scale = category === "forex" ? 0.5 : category === "crypto" ? 4 : 2; // % move that counts as "strong"
  const x = (Number(change24h) || 0) / scale;
  return Math.round(50 + 30 * Math.tanh(x));
}

/** Blend real platform positions (by lots) with the market estimate once enough traders exist. */
export function blendSentiment(estimate: number, real?: { buy: number; sell: number } | null): { bullish: number; source: "market" | "traders" } {
  if (!real || real.buy + real.sell <= 0) return { bullish: estimate, source: "market" };
  const realPct = (real.buy / (real.buy + real.sell)) * 100;
  return { bullish: Math.round(realPct * 0.7 + estimate * 0.3), source: "traders" };
}

export interface JournalTrade {
  symbol: string;
  pnl: number;
  opened_at: string;
  closed_at?: string;
  category?: string;
}

export interface JournalStats {
  count: number;
  wins: number;
  losses: number;
  winRate: number; // %
  profitFactor: number | null; // null when no losses
  avgWin: number;
  avgLoss: number;
  winLossRatio: number | null;
  avgHoldMs: number;
  net: number;
}

export function journalStats(trades: JournalTrade[]): JournalStats {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const holds = trades.filter((t) => t.closed_at).map((t) => new Date(t.closed_at!).getTime() - new Date(t.opened_at).getTime()).filter((d) => d >= 0);
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  return {
    count: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    avgWin,
    avgLoss,
    winLossRatio: avgLoss > 0 ? avgWin / avgLoss : null,
    avgHoldMs: holds.length ? holds.reduce((a, b) => a + b, 0) / holds.length : 0,
    net: grossWin - grossLoss,
  };
}

export function groupPnl<T extends JournalTrade>(trades: T[], key: (t: T) => string): { name: string; pnl: number; count: number }[] {
  const m = new Map<string, { pnl: number; count: number }>();
  trades.forEach((t) => {
    const k = key(t);
    const e = m.get(k) ?? { pnl: 0, count: 0 };
    e.pnl += t.pnl; e.count += 1; m.set(k, e);
  });
  return [...m].map(([name, v]) => ({ name, ...v }));
}

export function fmtDuration(ms: number): string {
  if (!ms) return "—";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
