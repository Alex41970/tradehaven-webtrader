import { useEffect, useSyncExternalStore } from 'react';
import { accountStore } from '@/services/account';
import type { AccountState } from '@/services/accountStore';
import { useAuth } from './useAuth';

/**
 * Reads one piece of the shared account record (profile, trades, link state).
 * Every screen gets the same copy, and re-renders only when that piece changes.
 * `select` must return a value straight from the state (no new objects).
 */
export const useAccount = <T,>(select: (s: AccountState) => T): T => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!loading) accountStore.setUser(userId);
  }, [userId, loading]);

  return useSyncExternalStore(accountStore.subscribe, () => select(accountStore.getState()));
};
