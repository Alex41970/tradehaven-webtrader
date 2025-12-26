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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ResetAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    user_id: string;
    email: string;
    first_name?: string;
    surname?: string;
    balance: number;
  } | null;
  openTradesCount: number;
  onSuccess: () => void;
}

export const ResetAccountDialog: React.FC<ResetAccountDialogProps> = ({
  open,
  onOpenChange,
  user,
  openTradesCount,
  onSuccess,
}) => {
  const { user: adminUser } = useAuth();
  const [closeTrades, setCloseTrades] = useState(true);
  const [clearHistory, setClearHistory] = useState(false);
  const [resetBalance, setResetBalance] = useState(true);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReset = async () => {
    if (!user || !adminUser) return;
    if (confirmEmail !== user.email) {
      toast.error('Email confirmation does not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('admin_reset_account', {
        _admin_id: adminUser.id,
        _user_id: user.user_id,
        _close_trades: closeTrades,
        _clear_history: clearHistory,
        _reset_balance: resetBalance,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; trades_closed?: number; trades_deleted?: number; previous_balance?: number };

      if (!result?.success) {
        toast.error(result?.error || 'Failed to reset account');
        return;
      }

      toast.success(`Account reset successfully. ${result.trades_closed || 0} trades closed, previous balance: $${result.previous_balance?.toFixed(2) || '0.00'}`);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setConfirmEmail('');
    setCloseTrades(true);
    setClearHistory(false);
    setResetBalance(true);
    onOpenChange(false);
  };

  const userName = user?.first_name && user?.surname 
    ? `${user.first_name} ${user.surname}` 
    : user?.email || 'Unknown User';

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">Reset Account: {userName}</AlertDialogTitle>
          <AlertDialogDescription>
            This action will reset the user's account. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <p className="text-sm"><strong>Current Balance:</strong> ${user?.balance?.toFixed(2) || '0.00'}</p>
            <p className="text-sm"><strong>Open Trades:</strong> {openTradesCount}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="closeTrades"
                checked={closeTrades}
                onCheckedChange={(checked) => setCloseTrades(checked === true)}
              />
              <Label htmlFor="closeTrades" className="cursor-pointer">
                Close all open trades (releases margin, no P&L applied)
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="clearHistory"
                checked={clearHistory}
                onCheckedChange={(checked) => setClearHistory(checked === true)}
              />
              <Label htmlFor="clearHistory" className="cursor-pointer">
                Clear all trade history
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="resetBalance"
                checked={resetBalance}
                onCheckedChange={(checked) => setResetBalance(checked === true)}
              />
              <Label htmlFor="resetBalance" className="cursor-pointer">
                Reset balance to $0
              </Label>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="confirmEmail">Type the user's email to confirm:</Label>
            <Input
              id="confirmEmail"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user?.email}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReset}
            disabled={confirmEmail !== user?.email || isSubmitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? 'Resetting...' : 'Reset Account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
