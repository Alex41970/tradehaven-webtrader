import { useCallback } from 'react';
import { accountStore } from '@/services/account';
import { useAccount } from './useAccount';

export type { UserProfile } from '@/services/accountStore';

/**
 * The signed-in client's profile (own funds, credit, margin figures) from the shared
 * account record. It is refreshed after every trade action and by one shared periodic
 * check, however many screens use it. The argument is kept for older callers.
 */
export const useSharedUserProfile = (_hasActiveTrades = false) => {
  const profile = useAccount((s) => s.profile);
  const loading = useAccount((s) => s.profileLoading);

  const forceRefresh = useCallback(async () => {
    await accountStore.refresh();
    return accountStore.getState().profile;
  }, []);

  return { profile, loading, refetch: forceRefresh, forceRefresh };
};
