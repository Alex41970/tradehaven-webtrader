import { useEffect, useCallback, useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface BotSettings {
  notifyTradeOpened: boolean;
  notifyTradeClosed: boolean;
  notifyProfitLoss: boolean;
}

interface NotificationOptions {
  title: string;
  body: string;
  type: 'trade_opened' | 'trade_closed' | 'profit_loss';
  tradeSource?: 'bot' | 'user';
  botSettings?: BotSettings;
}

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isTabActive, setIsTabActive] = useState(true);

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      toast({
        title: 'Notifications Not Supported',
        description: 'Your browser does not support notifications.',
        variant: 'destructive',
      });
      return false;
    }

    if (permission === 'granted') {
      return true;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast({
          title: 'Notifications Enabled',
          description: 'You will now receive bot trading notifications.',
        });
        return true;
      } else {
        toast({
          title: 'Notifications Blocked',
          description: 'Please enable notifications in your browser settings.',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [permission]);

  // Show notification based on settings and context
  const showNotification = useCallback((options: NotificationOptions) => {
    const { title, body, type, tradeSource, botSettings } = options;

    // Only show notifications for bot trades
    if (tradeSource !== 'bot') {
      return;
    }

    // Check bot settings
    if (!botSettings) {
      return;
    }

    if (type === 'trade_opened' && !botSettings.notifyTradeOpened) {
      return;
    }

    if (type === 'trade_closed' && !botSettings.notifyTradeClosed) {
      return;
    }

    if (type === 'profit_loss' && !botSettings.notifyProfitLoss) {
      return;
    }

    // Choose notification method based on tab visibility
    if (!isTabActive && permission === 'granted') {
      // Browser notification (tab inactive)
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `bot-trade-${Date.now()}`,
        });
      } catch (error) {
        console.error('Error showing browser notification:', error);
        // Fallback to toast
        toast({
          title,
          description: body,
        });
      }
    } else {
      // Toast notification (tab active or no permission)
      toast({
        title,
        description: body,
      });
    }
  }, [isTabActive, permission]);

  return {
    permission,
    requestPermission,
    showNotification,
    isTabActive,
  };
};
