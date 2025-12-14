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
      const delay = 1000 + attempt * 1000;
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
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('admin_id')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          if (attempt < maxAttempts) {
            scheduleNext();
          } else {
            setHasChecked(true);
          }
          return;
        }

        if (profile?.admin_id) {
          setHasChecked(true);
          return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        let promoCode: string | undefined =
          urlParams.get('promo') ||
          localStorage.getItem('signup_promo_code') ||
          (session.user.user_metadata?.promo_code as string | undefined);

        if (!promoCode) {
          setHasChecked(true);
          return;
        }

        promoCode = promoCode.trim();

        const { data: assignResult, error: assignError } = await supabase.rpc(
          'assign_user_to_admin_via_promo',
          {
            _user_id: user.id,
            _promo_code: promoCode
          }
        );

        if (assignError) {
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
          localStorage.removeItem('signup_promo_code');

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
      } catch {
        if (attempt < maxAttempts) {
          scheduleNext();
        } else {
          setHasChecked(true);
        }
      }
    };

    const initialTimer = setTimeout(() => {
      tryAssign();
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
    };
  }, [user, session, hasChecked]);
};
