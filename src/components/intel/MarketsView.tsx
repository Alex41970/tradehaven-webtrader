import { useMemo, useState } from "react";
import { Bento, BentoHeader, EmptyState } from "@/components/dashboard/widgets";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, Trash2, ArrowUpDown } from "lucide-react";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";
import { cn } from "@/lib/utils";

type A = { id: string; symbol: string; name: string; category: string; price: number; change_24h: number; is_active: boolean };
const CATS: [string, string][] = [["crypto", "Crypto"], ["stocks", "Stocks"], ["forex", "Forex"], ["indices", "Indices"], ["commodities", "Commodities"]];

const tileTone = (c: number) => {
  const a = Math.min(Math.abs(c) / 5, 1) * 0.75 + 0.15;
  return c >= 0 ? { backgroundColor: `hsl(var(--success) / ${a})` } : { backgroundColor: `hsl(var(--destructive) / ${a})` };
};

export const MarketsView = ({ assets, onOpen }: { assets: A[]; onOpen: (symbol: string) => void }) => {
  const [cat, setCat] = useState("crypto");
  const [filter, setFilter] = useState<"all" | "gainers" | "losers">("all");
  const [sort, setSort] = useState<{ k: "change_24h" | "price" | "symbol"; asc: boolean }>({ k: "change_24h", asc: false });
  const [q, setQ] = useState("");
  const { alerts, soundOn, setSoundOn, deleteAlert, testChime } = usePriceAlerts();

  const active = assets.filter((a) => a.is_active && a.price > 0);
  const heat = useMemo(() => active.filter((a) => a.category === cat).sort((a, b) => Math.abs(b.change_24h) - Math.abs(a.change_24h)).slice(0, 60), [active, cat]);

  const rows = useMemo(() => {
    let r = active.filter((a) => (a.symbol + a.name).toLowerCase().includes(q.toLowerCase()));
    if (filter === "gainers") r = r.filter((a) => a.change_24h > 0);
    if (filter === "losers") r = r.filter((a) => a.change_24h < 0);
    r = [...r].sort((a, b) => {
      const v = sort.k === "symbol" ? a.symbol.localeCompare(b.symbol) : (a[sort.k] as number) - (b[sort.k] as number);
      return sort.asc ? v : -v;
    });
    if (filter !== "all") r = filter === "gainers" ? r.sort((a, b) => b.change_24h - a.change_24h) : r.sort((a, b) => a.change_24h - b.change_24h);
    return r.slice(0, 150);
  }, [active, q, filter, sort]);

  const SortH = ({ k, children, right }: { k: typeof sort.k; children: string; right?: boolean }) => (
    <TableHead className={right ? "text-right" : ""}>
      <button className="inline-flex items-center gap-1" onClick={() => setSort((s) => ({ k, asc: s.k === k ? !s.asc : false }))}>{children}<ArrowUpDown className="h-3 w-3" /></button>
    </TableHead>
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <h1 className="text-2xl font-semibold">Markets</h1>
      <Bento className="p-4">
        <BentoHeader title="Heatmap" subtitle="24h change, strongest moves first"
          right={<Tabs value={cat} onValueChange={setCat}><TabsList className="h-8">{CATS.map(([v, l]) => <TabsTrigger key={v} value={v} className="text-xs">{l}</TabsTrigger>)}</TabsList></Tabs>} />
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5 md:grid-cols-8 xl:grid-cols-10">
          {heat.map((a) => (
            <button key={a.id} onClick={() => onOpen(a.symbol)} style={tileTone(a.change_24h)}
              className="flex aspect-[4/3] flex-col items-center justify-center rounded-lg p-1 text-foreground transition-transform hover:scale-[1.04]">
              <span className="truncate text-xs font-semibold">{a.symbol}</span>
              <span className="num text-[11px]">{a.change_24h >= 0 ? "+" : ""}{a.change_24h.toFixed(2)}%</span>
            </button>
          ))}
        </div>
      </Bento>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Bento className="p-4">
          <BentoHeader title="Screener" subtitle="Click a market to trade it"
            right={<div className="flex gap-2">
              <Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-28 sm:w-36" />
              <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}><TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="gainers" className="text-xs">Top gainers</TabsTrigger>
                <TabsTrigger value="losers" className="text-xs">Top losers</TabsTrigger>
              </TabsList></Tabs>
            </div>} />
          <div className="mt-2 max-h-[560px] overflow-auto">
            <Table>
              <TableHeader><TableRow><SortH k="symbol">Market</SortH><TableHead className="hidden sm:table-cell">Category</TableHead><SortH k="price" right>Price</SortH><SortH k="change_24h" right>24h</SortH></TableRow></TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => onOpen(a.symbol)}>
                    <TableCell><div className="font-medium">{a.symbol}</div><div className="max-w-[220px] truncate text-xs text-muted-foreground">{a.name}</div></TableCell>
                    <TableCell className="hidden text-xs capitalize text-muted-foreground sm:table-cell">{a.category}</TableCell>
                    <TableCell className="num text-right">{a.price.toLocaleString(undefined, { maximumFractionDigits: a.price < 10 ? 5 : 2 })}</TableCell>
                    <TableCell className={cn("num text-right", a.change_24h >= 0 ? "text-success" : "text-destructive")}>{a.change_24h >= 0 ? "+" : ""}{a.change_24h.toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Bento>

        <Bento className="p-4">
          <BentoHeader title="My alerts" subtitle="Set from the bell on the trade screen" right={<Bell className="h-4 w-4 text-muted-foreground" />} />
          <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span>Alert sound</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={testChime}>Test</Button>
              <Switch checked={soundOn} onCheckedChange={setSoundOn} aria-label="Alert sound" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {alerts.length === 0 && <EmptyState text="No alerts yet" />}
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{a.symbol} <span className="num text-muted-foreground">{a.direction === "above" ? "≥" : "≤"} {Number(a.target_price)}</span></div>
                  <div className="text-[11px] text-muted-foreground">{a.is_active ? "Waiting" : `Triggered ${a.triggered_at ? new Date(a.triggered_at).toLocaleString() : ""}`}</div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteAlert(a.id)} aria-label="Delete alert"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        </Bento>
      </div>
    </div>
  );
};
