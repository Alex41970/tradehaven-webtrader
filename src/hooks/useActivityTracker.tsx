import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useActivityTracker = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const updateActivity = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await fetch(`https://stdfkfutgkmnaajixguz.supabase.co/functions/v1/update-user-activity`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Failed to update activity:', error);
      }
    };

    // Update immediately on mount
    updateActivity();

    // Update every 2 minutes while user is on the page
    const interval = setInterval(updateActivity, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [user]);
};
