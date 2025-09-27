import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { getActivityAwareSubscriptionManager } from "@/services/ActivityAwareSubscriptionManager";

export interface BotStatus {
  isConnected: boolean;
  botStatus: 'active' | 'paused';
  licenseKey: string | null;
  permissions: {
    trade_execution: boolean;
    history_access: boolean;
    analytics_access: boolean;
  };
  loading: boolean;
}

export const useBotStatus = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [botStatus, setBotStatus] = useState<BotStatus>({
    isConnected: false,
    botStatus: 'active',
    licenseKey: null,
    permissions: {
      trade_execution: true,
      history_access: true,
      analytics_access: true,
    },
    loading: true,
  });

  useEffect(() => {
    if (user) {
      fetchBotStatus();
      
      // Set up activity-aware real-time subscription for bot status changes
      const subscriptionManager = getActivityAwareSubscriptionManager(supabase);
      const subscriptionId = subscriptionManager.subscribe({
        channel: 'bot-status-changes',
        event: '*',
        schema: 'public',
        table: 'user_bot_status',
        filter: `user_id=eq.${user.id}`,
        callback: () => {
          // Refetch bot status when changes occur
          fetchBotStatus();
        }
      });

      return () => {
        subscriptionManager.unsubscribe(subscriptionId);
      };
    } else {
      setBotStatus(prev => ({ ...prev, loading: false, isConnected: false }));
    }
  }, [user]);

  const fetchBotStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('get_valid_bot_status', {
        _user_id: user?.id,
      });

      if (error) throw error;

      const result = data as any;
      
      if (!result.valid) {
        // License is invalid or expired, disconnect user
        setBotStatus({
          isConnected: false,
          botStatus: 'active',
          licenseKey: null,
          permissions: {
            trade_execution: true,
            history_access: true,
            analytics_access: true,
          },
          loading: false,
        });
        return;
      }

      const botData = result.bot_status;
      setBotStatus({
        isConnected: true,
        botStatus: (botData?.bot_status as 'active' | 'paused') || 'active',
        licenseKey: botData?.license_key || null,
        permissions: (botData?.permissions as any) || {
          trade_execution: true,
          history_access: true,
          analytics_access: true,
        },
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching bot status:', error);
      setBotStatus(prev => ({ ...prev, loading: false, isConnected: false }));
    }
  };

  const activateLicense = async (licenseKey: string) => {
    try {
      const { data, error } = await supabase.rpc('activate_bot_license', {
        _user_id: user?.id,
        _license_key: licenseKey,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        toast({
          title: "License Activation Failed",
          description: result.error,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "License Activated",
        description: "Trading bot license activated successfully!",
      });

      await fetchBotStatus();
      return true;
    } catch (error) {
      console.error('Error activating license:', error);
      toast({
        title: "Activation Error",
        description: "Failed to activate license. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const pauseBot = async () => {
    try {
      const { error } = await supabase
        .from('user_bot_status')
        .update({ bot_status: 'paused' })
        .eq('user_id', user?.id);

      if (error) throw error;

      setBotStatus(prev => ({ ...prev, botStatus: 'paused' }));
      
      toast({
        title: "Bot Paused",
        description: "Trading bot has been paused.",
      });
    } catch (error) {
      console.error('Error pausing bot:', error);
      toast({
        title: "Error",
        description: "Failed to pause bot.",
        variant: "destructive",
      });
    }
  };

  const resumeBot = async () => {
    try {
      const { error } = await supabase
        .from('user_bot_status')
        .update({ bot_status: 'active' })
        .eq('user_id', user?.id);

      if (error) throw error;

      setBotStatus(prev => ({ ...prev, botStatus: 'active' }));
      
      toast({
        title: "Bot Resumed",
        description: "Trading bot has been resumed.",
      });
    } catch (error) {
      console.error('Error resuming bot:', error);
      toast({
        title: "Error",
        description: "Failed to resume bot.",
        variant: "destructive",
      });
    }
  };

  const disconnectBot = async () => {
    try {
      // First remove bot status
      const { error: statusError } = await supabase
        .from('user_bot_status')
        .delete()
        .eq('user_id', user?.id);

      if (statusError) throw statusError;

      // Then free up the license
      const { error: licenseError } = await supabase
        .from('bot_licenses')
        .update({ used_by_user_id: null })
        .eq('used_by_user_id', user?.id);

      if (licenseError) throw licenseError;

      setBotStatus({
        isConnected: false,
        botStatus: 'active',
        licenseKey: null,
        permissions: {
          trade_execution: true,
          history_access: true,
          analytics_access: true,
        },
        loading: false,
      });

      toast({
        title: "Bot Disconnected",
        description: "Trading bot has been disconnected.",
      });
    } catch (error) {
      console.error('Error disconnecting bot:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect bot.",
        variant: "destructive",
      });
    }
  };

  return {
    botStatus,
    activateLicense,
    pauseBot,
    resumeBot,
    disconnectBot,
    refetch: fetchBotStatus,
  };
};