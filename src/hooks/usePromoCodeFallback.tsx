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

    const attemptFallbackAssignment = async () => {
      try {
        // Check if user already has an admin assigned
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('admin_id')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          console.error('Error checking user profile:', profileError);
          setHasChecked(true);
          return;
        }

        // If admin_id already set, no need for fallback
        if (profile?.admin_id) {
          setHasChecked(true);
          return;
        }

        // Look for promo code in URL params first
        const urlParams = new URLSearchParams(window.location.search);
        let promoCode = urlParams.get('promo');

        // If not in URL, check localStorage
        if (!promoCode) {
          promoCode = localStorage.getItem('signup_promo_code');
        }

        if (!promoCode) {
          setHasChecked(true);
          return;
        }

        console.log('🔧 Attempting fallback promo assignment for user:', user.id, 'code:', promoCode);

        // Attempt to assign user to admin via promo code
        const { data: assignResult, error: assignError } = await supabase.rpc(
          'assign_user_to_admin_via_promo',
          {
            _user_id: user.id,
            _promo_code: promoCode.trim()
          }
        );

        if (assignError) {
          console.error('Fallback assignment error:', assignError);
          toast({
            variant: "destructive",
            title: "Promo Code Assignment Failed",
            description: "Could not assign you to an admin. Please contact support.",
          });
        } else if (assignResult && typeof assignResult === 'object' && 'success' in assignResult && assignResult.success) {
          console.log('✅ Fallback assignment successful:', assignResult);
          
          // Clear promo code from storage
          localStorage.removeItem('signup_promo_code');
          
          // Remove promo param from URL without page reload
          if (urlParams.has('promo')) {
            urlParams.delete('promo');
            const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
            window.history.replaceState({}, '', newUrl);
          }

          toast({
            title: "Welcome!",
            description: "Your account has been successfully set up.",
          });
        } else {
          console.error('Fallback assignment failed:', assignResult);
          const errorMsg = assignResult && typeof assignResult === 'object' && 'error' in assignResult 
            ? String(assignResult.error) 
            : "Could not process promo code";
          toast({
            variant: "destructive",
            title: "Assignment Error",
            description: errorMsg,
          });
        }
      } catch (error) {
        console.error('Fallback assignment exception:', error);
      } finally {
        setHasChecked(true);
      }
    };

    // Small delay to ensure profile is created
    const timer = setTimeout(() => {
      attemptFallbackAssignment();
    }, 1000);

    return () => clearTimeout(timer);
  }, [user, session, hasChecked]);
};
