import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface DeleteTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: {
    id: string;
    symbol: string;
    trade_type: string;
    amount: number;
    open_price: number;
    pnl: number | null;
    margin_used?: number;
    status: string;
    user_email?: string;
  } | null;
  onSuccess: () => void;
}

export const DeleteTradeDialog: React.FC<DeleteTradeDialogProps> = ({
  open,
  onOpenChange,
  trade,
  onSuccess,
}) => {
  const { user: adminUser } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!trade || !adminUser) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc('admin_delete_trade', {
        _admin_id: adminUser.id,
        _trade_id: trade.id,
      });

      if (error) throw error;

      const result = data as {
        success: boolean; error?: string; margin_released?: number; pnl_reversed?: number;
        balance_change?: number; credit_returned?: number; write_off_cancelled?: number; closed_before_reset?: boolean;
      };

      if (!result?.success) {
        toast.error(result?.error || 'Failed to delete trade');
        return;
      }

      // Say exactly where the money went: credit that paid for a loss comes back as credit, never as cash
      const usd = (n: number) => `$${Math.abs(n).toFixed(2)}`;
      const parts: string[] = ['Trade deleted.'];
      if (result.margin_released && result.margin_released > 0) parts.push(`Margin released: ${usd(result.margin_released)}.`);
      if (result.closed_before_reset) {
        parts.push('It was closed before the last account reset, so no money changed.');
      } else {
        if (result.balance_change) parts.push(`Balance ${result.balance_change > 0 ? '+' : '−'}${usd(result.balance_change)}.`);
        if (result.credit_returned && result.credit_returned > 0) parts.push(`Credit returned: ${usd(result.credit_returned)}.`);
        if (result.write_off_cancelled && result.write_off_cancelled > 0) parts.push(`${usd(result.write_off_cancelled)} of the loss had already been cleared by the company, so it is not paid back.`);
      }
      const message = parts.join(' ');

      toast.success(message);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete trade');
    } finally {
      setIsDeleting(false);
    }
  };

  const isOpen = trade?.status === 'open';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">Delete Trade</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this trade. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {trade && (
          <div className="space-y-3 py-4">
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Symbol:</span>
                <span className="font-medium">{trade.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Type:</span>
                <Badge variant={trade.trade_type === 'BUY' ? 'default' : 'destructive'}>
                  {trade.trade_type}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount:</span>
                <span className="font-medium">{trade.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Open Price:</span>
                <span className="font-medium">${trade.open_price?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant={isOpen ? 'outline' : 'secondary'}>
                  {trade.status}
                </Badge>
              </div>
              {trade.user_email && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">User:</span>
                  <span className="text-sm">{trade.user_email}</span>
                </div>
              )}
            </div>

            <div className="p-3 border rounded-lg border-warning/50 bg-warning/10">
              <p className="text-sm">
                {isOpen ? (
                  <>
                    <strong>Open trade:</strong> Margin of ${trade.margin_used?.toFixed(2) || '0.00'} will be released back to the user.
                  </>
                ) : (
                  <>
                    <strong>Closed trade:</strong> P&L of ${trade.pnl?.toFixed(2) || '0.00'} will be reversed. A loss that was paid with credit comes back as credit, not as cash.
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete Trade'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
