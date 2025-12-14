import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";
import { getActivityAwareSubscriptionManager } from "@/services/ActivityAwareSubscriptionManager";

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

export const useTransactionHistory = () => {
  const { user } = useAuth();
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTransactions();
      setupRealtimeSubscriptions();
    } else {
      setDeposits([]);
      setWithdrawals([]);
      setLoading(false);
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
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
  };

  const setupRealtimeSubscriptions = () => {
    if (!user) return;

    const subscriptionManager = getActivityAwareSubscriptionManager(supabase);
    
    const depositSubscriptionId = subscriptionManager.subscribe({
      channel: 'deposit-requests-changes',
      event: '*',
      schema: 'public',
      table: 'deposit_requests',
      filter: `user_id=eq.${user.id}`,
      callback: (payload) => {
        if (payload.eventType === 'INSERT') {
          setDeposits(prev => [payload.new as DepositRequest, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setDeposits(prev => prev.map(deposit => 
            deposit.id === payload.new.id ? payload.new as DepositRequest : deposit
          ));
        }
      }
    });

    const withdrawalSubscriptionId = subscriptionManager.subscribe({
      channel: 'withdrawal-requests-changes',
      event: '*',
      schema: 'public',
      table: 'withdrawal_requests',
      filter: `user_id=eq.${user.id}`,
      callback: (payload) => {
        if (payload.eventType === 'INSERT') {
          setWithdrawals(prev => [payload.new as WithdrawalRequest, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setWithdrawals(prev => prev.map(withdrawal => 
            withdrawal.id === payload.new.id ? payload.new as WithdrawalRequest : withdrawal
          ));
        }
      }
    });

    return () => {
      subscriptionManager.unsubscribe(depositSubscriptionId);
      subscriptionManager.unsubscribe(withdrawalSubscriptionId);
    };
  };

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