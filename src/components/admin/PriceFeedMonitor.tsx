import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type Health = { symbol: string; category: string; price: number; price_source: string | null; updated_age_s: number | null; changed_age_s: number | null; candles_24h: number; status: string };
type Run = { id: number; ran_at: string; duration_ms: number; markets_total: number; markets_updated: number; missing: string[]; provider_calls: Record<string, number>; rejected: { symbol: string; old: number; new: number }[]; errors: string[]; backfilled: number };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = { live: "default", closed: "secondary", frozen: "destructive", stale: "destructive", bad_price: "destructive" };
const age = (s: number | null) => (s == null ? "never" : s < 120 ? `${s}s` : s < 7200 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`);

export default function PriceFeedMonitor() {
  const [health, setHealth] = useState<Health[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    setLoading(true);
    const [h, r] = await Promise.all([
      supabase.rpc("get_market_health"),
      supabase.from("price_feed_runs").select("*").order("ran_at", { ascending: false }).limit(30),
    ]);
    if (h.data) setHealth(h.data as Health[]);
    if (r.data) setRuns(r.data as unknown as Run[]);
    setLoading(false);
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const counts = useMemo(() => health.reduce<Record<string, number>>((m, x) => ((m[x.status] = (m[x.status] ?? 0) + 1), m), {}), [health]);
  const problems = health.filter((x) => !["live", "closed"].includes(x.status) || x.candles_24h === 0);
  const last = runs[0];
  const runAge = last ? Math.round((Date.now() - new Date(last.ran_at).getTime()) / 1000) : null;
  const recentErrors = runs.flatMap((r) => r.errors.map((e) => ({ at: r.ran_at, e }))).slice(0, 15);
  const recentRejects = runs.flatMap((r) => (r.rejected ?? []).map((x) => ({ at: r.ran_at, ...x }))).slice(0, 15);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Price feed watcher</CardTitle>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><div className="text-muted-foreground">Last run</div><div className="font-semibold">{runAge == null ? "none yet" : `${age(runAge)} ago`}</div>{runAge != null && runAge > 180 && <Badge variant="destructive">Feed stopped</Badge>}</div>
          <div><div className="text-muted-foreground">Markets updated</div><div className="font-semibold">{last ? `${last.markets_updated}/${last.markets_total}` : "-"}</div></div>
          <div><div className="text-muted-foreground">Run time</div><div className="font-semibold">{last ? `${(last.duration_ms / 1000).toFixed(0)}s` : "-"}</div></div>
          <div><div className="text-muted-foreground">Yahoo calls (limit)</div><div className="font-semibold">{last ? `${last.provider_calls.yahoo ?? 0} / ${last.provider_calls.yahoo_budget ?? "-"}` : "-"}</div></div>
          <div className="col-span-2 md:col-span-4 flex flex-wrap gap-2">
            {Object.entries(counts).map(([k, v]) => <Badge key={k} variant={STATUS_VARIANT[k] ?? "outline"}>{k}: {v}</Badge>)}
            {last && Object.entries(last.provider_calls).filter(([k]) => k !== "yahoo_budget").map(([k, v]) => <Badge key={k} variant="outline">{k} calls: {v}</Badge>)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{showAll ? `All markets (${health.length})` : `Markets needing attention (${problems.length})`}</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setShowAll((s) => !s)}>{showAll ? "Show problems only" : "Show all"}</Button>
        </CardHeader>
        <CardContent className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left"><tr><th>Market</th><th>Type</th><th>Price</th><th>Source</th><th>Fetched</th><th>Last move</th><th>Candles 24h</th><th>Status</th></tr></thead>
            <tbody>
              {(showAll ? health : problems).map((x) => (
                <tr key={x.symbol} className="border-t border-border">
                  <td className="py-1 font-medium">{x.symbol}</td><td>{x.category}</td><td>{Number(x.price)}</td><td>{x.price_source ?? "-"}</td>
                  <td>{age(x.updated_age_s)}</td><td>{age(x.changed_age_s)}</td><td>{x.candles_24h}</td>
                  <td><Badge variant={STATUS_VARIANT[x.status] ?? "outline"}>{x.status}</Badge></td>
                </tr>
              ))}
              {!showAll && problems.length === 0 && <tr><td colSpan={8} className="py-3 text-muted-foreground">All markets look healthy.</td></tr>}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-2">"closed" = the real price hasn't moved for 30 minutes (normal for stocks outside trading hours); simulated movement is switched off for those. "frozen" = a crypto price stuck for 30 minutes, which shouldn't happen.</p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle>Recent errors</CardTitle></CardHeader><CardContent className="text-xs space-y-1 max-h-64 overflow-auto">
          {recentErrors.length ? recentErrors.map((x, i) => <div key={i}><span className="text-muted-foreground">{new Date(x.at).toLocaleTimeString()}</span> {x.e}</div>) : <div className="text-muted-foreground">No errors in the last 30 runs.</div>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Blocked price jumps</CardTitle></CardHeader><CardContent className="text-xs space-y-1 max-h-64 overflow-auto">
          {recentRejects.length ? recentRejects.map((x, i) => <div key={i}><span className="text-muted-foreground">{new Date(x.at).toLocaleTimeString()}</span> {x.symbol}: {x.old} → {x.new}</div>) : <div className="text-muted-foreground">No suspicious jumps blocked.</div>}
        </CardContent></Card>
      </div>
    </div>
  );
}
