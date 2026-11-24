import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { CreditTransaction, CreditTransactionType } from "@/hooks/useTransactionHistory";
import { settleFlatAccount } from "@/utils/accountMetrics";
import { cn } from "@/lib/utils";

interface CreditUser {
  user_id: string;
  email: string;
  first_name?: string;
  surname?: string;
  balance: number;
  credit?: number;
  used_margin?: number;
}

interface ModifyCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CreditUser | null;
  onSuccess: () => void;
}

type Operation = "add" | "remove" | "set";

type CreditResult = {
  success: boolean;
  error?: string;
  code?: "margin_risk" | "not_enough_credit" | "no_change";
  message?: string;
  new_credit?: number;
  new_balance?: number;
};

const money = (n: number) =>
  `$${(Number.isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ENTRY_LABEL: Record<CreditTransactionType, string> = {
  credit_in: "Credit added",
  credit_out: "Credit removed",
  loss_cover: "Used to cover losses",
  loss_cover_reversal: "Returned (trade deleted)",
  negative_balance_reset: "Negative balance cleared",
  negative_balance_reset_reversal: "Clearing cancelled (trade deleted)",
  account_reset: "Account reset",
};

export const ModifyCreditDialog = ({ open, onOpenChange, user, onSuccess }: ModifyCreditDialogProps) => {
  const { user: admin } = useAuth();
  const { toast } = useToast();
  const [operation, setOperation] = useState<Operation>("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [marginWarning, setMarginWarning] = useState<string | null>(null);
  const [history, setHistory] = useState<CreditTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const userId = user?.user_id;

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setOperation("add");
    setAmount("");
    setReason("");
    setMarginWarning(null);
    setHistoryLoading(true);
    supabase
      .from("credit_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (cancelled) return;
        setHistory((data || []) as CreditTransaction[]);
        setHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, userId]);

  const current = Math.max(Number(user?.credit) || 0, 0);
  const balance = Number(user?.balance) || 0;
  const value = parseFloat(amount);
  const hasValue = Number.isFinite(value) && value >= 0;

  const preview = useMemo(() => {
    if (!hasValue) return null;
    const next = operation === "add" ? current + value : operation === "remove" ? current - value : value;
    return { next, change: next - current };
  }, [hasValue, operation, current, value]);

  const problem = !hasValue ? null
    : (operation !== "set" && value === 0) ? "Enter an amount above zero."
    : (operation === "remove" && value > current) ? `This client only has ${money(current)} credit.`
    : (preview && preview.change === 0) ? `Credit is already ${money(current)}.`
    : null;

  // A client with nothing open and a negative balance: new credit pays that off first
  const usedAtOnce = preview && preview.change > 0 && balance < 0 && !(Number(user?.used_margin) > 0)
    ? settleFlatAccount({ balance, credit: preview.next, allowNegativeBalance: true }).creditUsed
    : 0;

  const userName = user?.first_name && user?.surname ? `${user.first_name} ${user.surname}` : user?.email || "User";
  const canSubmit = !!user && !!admin && hasValue && !problem && reason.trim().length > 0 && !loading;

  const submit = async (force: boolean) => {
    if (!user || !admin || !hasValue) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_modify_user_credit", {
        _admin_id: admin.id,
        _user_id: user.user_id,
        _amount: value,
        _operation: operation,
        _reason: reason.trim(),
        _force: force,
      });
      if (error) throw error;
      const result = data as unknown as CreditResult | null;

      if (!result?.success) {
        if (result?.code === "margin_risk" && !force) {
          setMarginWarning(result.error || "Removing this credit may close the client's open trades.");
          return;
        }
        toast({ title: "Credit not changed", description: result?.error || "Something went wrong.", variant: "destructive" });
        return;
      }

      toast({
        title: result.message || "Credit updated",
        description: `${userName} now has ${money(result.new_credit ?? 0)} credit.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast({ title: "Credit not changed", description: e?.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Credit</DialogTitle>
          <DialogDescription>
            {userName} has {money(current)} credit. Credit is company money: the client can trade with it but can never withdraw it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="credit-operation">Action</Label>
              <Select value={operation} onValueChange={(v: Operation) => { setOperation(v); setMarginWarning(null); }}>
                <SelectTrigger id="credit-operation"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add credit</SelectItem>
                  <SelectItem value="remove">Remove credit</SelectItem>
                  <SelectItem value="set">Set credit to</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="credit-amount">Amount (USD)</Label>
              <Input id="credit-amount" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
                value={amount} onChange={(e) => { setAmount(e.target.value); setMarginWarning(null); }} />
            </div>
          </div>

          <div>
            <Label htmlFor="credit-reason">Reason</Label>
            <Textarea id="credit-reason" placeholder="e.g. Welcome bonus, Loyalty reward, Bonus period ended"
              value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[70px]" maxLength={300} />
            <p className="mt-1 text-xs text-muted-foreground">Saved in the credit history. The client can see this note.</p>
          </div>

          {problem && (
            <p className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{problem}</p>
          )}

          {preview && !problem && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Credit after this change</span>
                <span className="num font-medium">{money(preview.next)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Change</span>
                <span className={cn("num font-medium", preview.change >= 0 ? "text-success" : "text-destructive")}>
                  {preview.change >= 0 ? "+" : "−"}{money(Math.abs(preview.change))}
                </span>
              </div>
              <p className="mt-2 flex items-start gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {usedAtOnce > 0
                    ? `This client owes ${money(-balance)} and has nothing open, so ${money(usedAtOnce)} of this credit is used straight away to cover it.`
                    : "Balance and withdrawable money do not change. Equity and free margin move by the same amount."}
                </span>
              </p>
            </div>
          )}

          {marginWarning && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p className="flex items-start gap-2 text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{marginWarning}</span></p>
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setMarginWarning(null)} disabled={loading}>Keep the credit</Button>
                <Button size="sm" variant="destructive" onClick={() => submit(true)} disabled={loading}>
                  {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Remove anyway
                </Button>
              </div>
            </div>
          )}

          <div>
            <p className="label-caps mb-2">Recent credit history</p>
            {historyLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No credit has been given to this client yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border text-xs">
                {history.map((h) => {
                  const creditChange = Number(h.amount) || 0;
                  const balanceChange = Number(h.balance_change) || 0;
                  const shown = creditChange !== 0 ? creditChange : balanceChange;
                  return (
                    <li key={h.id} className="flex items-start justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-foreground">{ENTRY_LABEL[h.type] ?? h.type}</div>
                        <div className="truncate text-muted-foreground">
                          {new Date(h.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {" · "}{h.performed_by ? (h.performed_by === admin?.id ? "You" : "Staff") : "Automatic"}
                          {h.reason ? ` · ${h.reason}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={cn("num font-medium", shown >= 0 ? "text-success" : "text-destructive")}>
                          {shown >= 0 ? "+" : "−"}{money(Math.abs(shown))}
                        </div>
                        <div className="text-muted-foreground">{creditChange !== 0 ? "credit" : "balance"}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={() => submit(false)} disabled={!canSubmit || !!marginWarning}>
            {loading && !marginWarning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> :
              operation === "add" ? "Add credit" : operation === "remove" ? "Remove credit" : "Set credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
