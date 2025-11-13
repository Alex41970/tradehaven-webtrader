import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

/**
 * Hook to start the Twelve Data price relay on app initialization
 * Only runs once per session
 */
export const usePriceRelayStarter = () => {
  const hasStartedRef = useRef(false);

  useEffect(() => {
    const startRelay = async () => {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      try {
        logger.debug('🚀 Starting Twelve Data price relay...');
        
        const { data, error } = await supabase.functions.invoke('websocket-price-relay/start', {
          method: 'POST',
        });

        if (error) {
          logger.error('❌ Failed to start price relay:', error);
        } else {
          logger.debug('✅ Price relay started:', data);
        }
      } catch (error) {
        logger.error('❌ Error starting price relay:', error);
      }
    };

    // Start after 2 seconds to allow app to initialize
    const timer = setTimeout(startRelay, 2000);
    return () => clearTimeout(timer);
  }, []);
};
