import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// REMOVED: Generic subscription functions - no longer used
// Kept only useSystemHealth which is used by SystemHealthDashboard

/**
 * System health monitoring hook
 */
export const useSystemHealth = () => {
  const runHealthCheck = useCallback(async () => {
    const { data, error } = await supabase.rpc('run_system_health_check');
    if (error) throw error;
    return data;
  }, []);

  const autoFixIssues = useCallback(async () => {
    const { data, error } = await supabase.rpc('auto_fix_detected_issues');
    if (error) throw error;
    return data;
  }, []);

  return {
    runHealthCheck,
    autoFixIssues
  };
};
