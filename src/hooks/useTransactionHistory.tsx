import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";

export interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  deposit_type: string;
  status: 'pending' | 'approved' | 'rejected';
  crypto_wallet_address?: string;
  bank_details?: any;
  admin_notes?: string;
  processed_at?: string;
  processed_by_admin?: string;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  withdrawal_type: string;
  status: 'pending' | 'approved' | 'rejected';
  crypto_wallet_address?: string;
  bank_details?: any;
  admin_notes?: string;
  processed_at?: string;
  processed_by_admin?: string;
  created_at: string;
}

export type CreditTransactionType =
  | 'credit_in' | 'credit_out' | 'loss_cover' | 'loss_cover_reversal'
  | 'negative_balance_reset' | 'negative_balance_reset_reversal' | 'account_reset';

/** One line of the credit history kept by the server */
export interface CreditTransaction {
  id: string;
  user_id: string;
  type: CreditTransactionType;
  /** Signed change in credit */
  amount: number;
  /** Signed change in balance booked by the same entry */
  balance_change: number;
  credit_after: number;
  balance_after: number;
  reason?: string | null;
  performed_by?: string | null;
  trade_id?: string | null;
  created_at: string;
}

export type TransactionHistory = {
  id: string;
  type: 'deposit' | 'withdrawal' | 'credit';
  amount: number;
  method: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  processed_at?: string;
  admin_notes?: string;
  crypto_wallet_address?: string;
  bank_details?: any;
  /** Credit entries only: what happened, and whether money came in or went out */
  title?: string;
  direction?: 'in' | 'out';
};

/** How a credit entry reads for the client. Entries without a line here are bookkeeping only. */
export const describeCreditEntry = (c: CreditTransaction): { title: string; amount: number; direction: 'in' | 'out' } | null => {
  const credit = Math.abs(Number(c.amount) || 0);
  switch (c.type) {
    case 'credit_in': return { title: 'Credit added', amount: credit, direction: 'in' };
    case 'credit_out': return { title: 'Credit removed', amount: credit, direction: 'out' };
    case 'loss_cover': return { title: 'Credit used to cover losses', amount: credit, direction: 'out' };
    case 'loss_cover_reversal': return { title: 'Credit returned', amount: credit, direction: 'in' };
    case 'negative_balance_reset': return { title: 'Negative balance cleared', amount: Math.abs(Number(c.balance_change) || 0), direction: 'in' };
    case 'account_reset': return credit > 0 ? { title: 'Credit cleared (account reset)', amount: credit, direction: 'out' } : null;
    default: return null;
  }
};

const POLL_INTERVAL = 30000; // 30 seconds polling

export const useTransactionHistory = () => {
  const { user } = useAuth();
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [creditHistory, setCreditHistory] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch deposits
      const { data: depositsData, error: depositsError } = await supabase
        .from('deposit_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (depositsError) {
        toast({
          title: "Error",
          description: "Failed to fetch deposit history",
          variant: "destructive",
        });
      } else {
        setDeposits(depositsData as DepositRequest[] || []);
      }

      // Fetch withdrawals
      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (withdrawalsError) {
        toast({
          title: "Error",
          description: "Failed to fetch withdrawal history",
          variant: "destructive",
        });
      } else {
        setWithdrawals(withdrawalsData as WithdrawalRequest[] || []);
      }

      // Credit history (company money: added, removed, used to cover losses)
      const { data: creditData, error: creditError } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (!creditError) {
        setCreditHistory((creditData || []) as CreditTransaction[]);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch and polling setup
  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchTransactions();
      
      // Set up polling instead of Realtime subscription
      pollIntervalRef.current = setInterval(fetchTransactions, POLL_INTERVAL);
    } else {
      setDeposits([]);
      setWithdrawals([]);
      setCreditHistory([]);
      setLoading(false);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [user, fetchTransactions]);

  // Combine and format transactions for display
  const transactionHistory: TransactionHistory[] = [
    ...deposits.map(deposit => ({
      id: deposit.id,
      type: 'deposit' as const,
      amount: deposit.amount,
      method: deposit.deposit_type,
      status: deposit.status,
      created_at: deposit.created_at,
      processed_at: deposit.processed_at,
      admin_notes: deposit.admin_notes,
      crypto_wallet_address: deposit.crypto_wallet_address,
      bank_details: deposit.bank_details,
    })),
    ...withdrawals.map(withdrawal => ({
      id: withdrawal.id,
      type: 'withdrawal' as const,
      amount: withdrawal.amount,
      method: withdrawal.withdrawal_type,
      status: withdrawal.status,
      created_at: withdrawal.created_at,
      processed_at: withdrawal.processed_at,
      admin_notes: withdrawal.admin_notes,
      crypto_wallet_address: withdrawal.crypto_wallet_address,
      bank_details: withdrawal.bank_details,
    })),
    ...creditHistory.flatMap((entry): TransactionHistory[] => {
      const line = describeCreditEntry(entry);
      if (!line) return [];
      return [{
        id: entry.id,
        type: 'credit' as const,
        amount: line.amount,
        method: entry.type === 'negative_balance_reset' ? 'adjustment' : 'credit',
        status: 'approved' as const,
        created_at: entry.created_at,
        admin_notes: entry.reason || undefined,
        title: line.title,
        direction: line.direction,
      }];
    })
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    deposits,
    withdrawals,
    creditHistory,
    transactionHistory,
    loading,
    refetch: fetchTransactions,
  };
};
