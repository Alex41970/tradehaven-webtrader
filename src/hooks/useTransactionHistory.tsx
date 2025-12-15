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

export type TransactionHistory = {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  method: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  processed_at?: string;
  admin_notes?: string;
  crypto_wallet_address?: string;
  bank_details?: any;
};

const POLL_INTERVAL = 30000; // 30 seconds polling

export const useTransactionHistory = () => {
  const { user } = useAuth();
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
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
    }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    deposits,
    withdrawals,
    transactionHistory,
    loading,
    refetch: fetchTransactions,
  };
};
