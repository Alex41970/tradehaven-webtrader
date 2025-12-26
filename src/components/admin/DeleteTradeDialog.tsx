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

      const result = data as { success: boolean; error?: string; margin_released?: number; pnl_reversed?: number };

      if (!result?.success) {
        toast.error(result?.error || 'Failed to delete trade');
        return;
      }

      let message = 'Trade deleted successfully.';
      if (result.margin_released && result.margin_released > 0) {
        message += ` Margin released: $${result.margin_released.toFixed(2)}`;
      }
      if (result.pnl_reversed && result.pnl_reversed !== 0) {
        message += ` P&L reversed: $${result.pnl_reversed.toFixed(2)}`;
      }

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

            <div className="p-3 border rounded-lg border-amber-500/50 bg-amber-500/10">
              <p className="text-sm">
                {isOpen ? (
                  <>
                    <strong>Open trade:</strong> Margin of ${trade.margin_used?.toFixed(2) || '0.00'} will be released back to the user.
                  </>
                ) : (
                  <>
                    <strong>Closed trade:</strong> P&L of ${trade.pnl?.toFixed(2) || '0.00'} will be reversed from the user's balance.
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
