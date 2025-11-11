import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Hook to handle promo code fallback assignment after login
 * Runs once per session to catch cases where trigger assignment failed
 */
export const usePromoCodeFallback = () => {
  const { user, session } = useAuth();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (!user || !session || hasChecked) return;

    let isMounted = true;
    let attempt = 0;
    const maxAttempts = 5;

    const scheduleNext = () => {
      const delay = 1000 + attempt * 1000; // incremental backoff
      setTimeout(() => {
        if (isMounted && !hasChecked) {
          tryAssign();
        }
      }, delay);
    };

    const tryAssign = async () => {
      attempt++;
      if (!isMounted) return;

      try {
        console.log(`[PromoFallback] attempt ${attempt} for user ${user.id}`);

        // 1) Check if user already has an admin assigned
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('admin_id')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          console.warn('[PromoFallback] profile check error:', profileError);
          if (attempt < maxAttempts) {
            scheduleNext();
          } else {
            setHasChecked(true);
          }
          return;
        }

        // If admin_id already set, no need for fallback
        if (profile?.admin_id) {
          console.log('[PromoFallback] admin already assigned, skipping');
          setHasChecked(true);
          return;
        }

        // 2) Gather promo code from URL, localStorage, or user metadata
        const urlParams = new URLSearchParams(window.location.search);
        let promoCode: string | undefined =
          urlParams.get('promo') ||
          localStorage.getItem('signup_promo_code') ||
          (session.user.user_metadata?.promo_code as string | undefined);

        if (!promoCode) {
          console.log('[PromoFallback] no promo code found in url/localStorage/metadata');
          // Nothing else we can do here
          setHasChecked(true);
          return;
        }

        promoCode = promoCode.trim();
        console.log('[PromoFallback] Attempting RPC assign_user_to_admin_via_promo', { userId: user.id, promoCode });

        // 3) Attempt to assign user to admin via promo code
        const { data: assignResult, error: assignError } = await supabase.rpc(
          'assign_user_to_admin_via_promo',
          {
            _user_id: user.id,
            _promo_code: promoCode
          }
        );

        if (assignError) {
          console.error('[PromoFallback] RPC error:', assignError);
          if (attempt < maxAttempts) {
            scheduleNext();
          } else {
            toast({
              variant: 'destructive',
              title: 'Promo Code Assignment Failed',
              description: 'Could not assign you to an admin. Please contact support.',
            });
            setHasChecked(true);
          }
          return;
        }

        const success =
          assignResult === true ||
          (assignResult && typeof assignResult === 'object' && 'success' in assignResult && (assignResult as any).success);

        if (success) {
          console.log('[PromoFallback] assignment successful:', assignResult);

          // Clear promo code from storage
          localStorage.removeItem('signup_promo_code');

          // Remove promo param from URL without page reload
          if (urlParams.has('promo')) {
            urlParams.delete('promo');
            const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
            window.history.replaceState({}, '', newUrl);
          }

          toast({
            title: 'Welcome!',
            description: 'Your account has been successfully set up.',
          });
          setHasChecked(true);
        } else {
          console.warn('[PromoFallback] assignment not confirmed:', assignResult);
          if (attempt < maxAttempts) {
            scheduleNext();
          } else {
            toast({
              variant: 'destructive',
              title: 'Assignment Error',
              description: 'Could not process promo code',
            });
            setHasChecked(true);
          }
        }
      } catch (error) {
        console.error('[PromoFallback] exception:', error);
        if (attempt < maxAttempts) {
          scheduleNext();
        } else {
          setHasChecked(true);
        }
      }
    };

    // Small delay to ensure profile is created
    const initialTimer = setTimeout(() => {
      tryAssign();
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
    };
  }, [user, session, hasChecked]);
};
