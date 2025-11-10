import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useActivityTracker = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const updateActivity = async () => {
      try {
        await supabase.functions.invoke('update-user-activity');
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
