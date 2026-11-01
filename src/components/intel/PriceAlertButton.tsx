import { useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";
import { AlertDirection } from "@/utils/marketIntel";

export const PriceAlertButton = ({ symbol, price }: { symbol: string; price: number }) => {
  const { alerts, createAlert, deleteAlert } = usePriceAlerts();
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<AlertDirection>("above");
  const [target, setTarget] = useState("");
  const mine = alerts.filter((a) => a.symbol === symbol && a.is_active);

  const submit = async () => {
    const n = Number(target);
    if (await createAlert(symbol, dir, n)) setTarget("");
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o && !target) setTarget(String(price)); }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="relative h-7 gap-1 px-2 text-xs" aria-label="Price alert">
          <Bell className="h-4 w-4" />Alert
          {mine.length > 0 && <span className="num ml-0.5 rounded bg-primary px-1 text-[10px] text-primary-foreground">{mine.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div className="text-sm font-medium">Alert me when {symbol}</div>
        <ToggleGroup type="single" value={dir} onValueChange={(v) => v && setDir(v as AlertDirection)} className="grid grid-cols-2">
          <ToggleGroupItem value="above" className="text-xs">Goes above</ToggleGroupItem>
          <ToggleGroupItem value="below" className="text-xs">Goes below</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex gap-2">
          <Input type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className="num h-9" aria-label="Target price" />
          <Button size="sm" className="h-9" onClick={submit} disabled={!(Number(target) > 0)}>Set</Button>
        </div>
        <div className="text-[11px] text-muted-foreground">Now {price}. Alerts ring while the app is open.</div>
        {mine.length > 0 && (
          <div className="space-y-1 border-t border-border pt-2">
            {mine.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs">
                <span className="num">{a.direction === "above" ? "≥" : "≤"} {Number(a.target_price)}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteAlert(a.id)} aria-label="Delete alert"><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
