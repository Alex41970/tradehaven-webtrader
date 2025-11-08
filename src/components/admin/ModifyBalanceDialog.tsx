import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface UserProfile {
  user_id: string;
  email: string;
  first_name?: string;
  surname?: string;
  balance: number;
}

interface ModifyBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onModifyBalance: (userId: string, amount: number, operation: "add" | "deduct") => Promise<void>;
}

export const ModifyBalanceDialog = ({ 
  open, 
  onOpenChange, 
  user,
  onModifyBalance
}: ModifyBalanceDialogProps) => {
  const [amount, setAmount] = useState("");
  const [operation, setOperation] = useState<"add" | "deduct">("add");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !amount) return;
    
    setLoading(true);
    try {
      await onModifyBalance(user.user_id, parseFloat(amount), operation);
      setAmount("");
      setOperation("add");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const userName = user?.first_name && user?.surname 
    ? `${user.first_name} ${user.surname}`
    : user?.email || 'User';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modify Balance</DialogTitle>
          <DialogDescription>
            Current balance for {userName}: ${user?.balance?.toFixed(2) || '0.00'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="operation">Operation</Label>
            <Select value={operation} onValueChange={(value: "add" | "deduct") => setOperation(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add Funds</SelectItem>
                <SelectItem value="deduct">Deduct Funds</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          
          {amount && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Preview</p>
              <p className="text-lg">
                New Balance: ${((user?.balance || 0) + (operation === 'add' ? 1 : -1) * parseFloat(amount || '0')).toFixed(2)}
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!amount || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `${operation === 'add' ? 'Add' : 'Deduct'} Funds`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
