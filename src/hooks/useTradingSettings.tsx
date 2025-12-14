import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { PriceIntensity } from './useOptimizedPriceUpdates';

export type { PriceIntensity } from './useOptimizedPriceUpdates';

interface TradingSettings {
  priceIntensity: PriceIntensity;
  isMarketClosed: boolean;
  canTrade: boolean;
  tradingHoursEnabled: boolean;
  marketOpenTime: string;
  marketCloseTime: string;
  tradingTimezone: string;
  tradingDays: string[];
  isLoading: boolean;
}

interface AdminTradingSettingsRow {
  id: string;
  admin_id: string;
  price_intensity: string;
  market_closed: boolean;
  trading_hours_enabled: boolean;
  market_open_time: string;
  market_close_time: string;
  trading_timezone: string;
  trading_days: string[];
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: TradingSettings = {
  priceIntensity: 'medium',
  isMarketClosed: false,
  canTrade: true,
  tradingHoursEnabled: false,
  marketOpenTime: '09:30',
  marketCloseTime: '16:00',
  tradingTimezone: 'America/New_York',
  tradingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  isLoading: true,
};

// Check if current time is within trading hours
const isWithinTradingHours = (
  openTime: string,
  closeTime: string,
  timezone: string,
  tradingDays: string[]
): boolean => {
  try {
    const now = new Date();
    
    // Get current day name
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];
    
    // Check if today is a trading day
    if (!tradingDays.includes(currentDay)) {
      return false;
    }
    
    // Parse times and compare (simplified - uses local time for now)
    const [openHour, openMin] = openTime.split(':').map(Number);
    const [closeHour, closeMin] = closeTime.split(':').map(Number);
    
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;
    
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } catch {
    return true; // Default to open on error
  }
};

export const useTradingSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TradingSettings>(DEFAULT_SETTINGS);

  const fetchSettings = useCallback(async () => {
    if (!user?.id) {
      setSettings({ ...DEFAULT_SETTINGS, isLoading: false });
      return;
    }

    try {
      // First, get user's admin_id from user_profiles
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('admin_id')
        .eq('user_id', user.id)
        .single();

      const adminId = profile?.admin_id;

      if (!adminId) {
        // No admin assigned, use defaults
        setSettings({ ...DEFAULT_SETTINGS, isLoading: false });
        return;
      }

      // Fetch admin's trading settings
      const { data: adminSettings } = await supabase
        .from('admin_trading_settings')
        .select('*')
        .eq('admin_id', adminId)
        .single();

      if (!adminSettings) {
        // Admin hasn't configured settings, use defaults
        setSettings({ ...DEFAULT_SETTINGS, isLoading: false });
        return;
      }

      const typedSettings = adminSettings as AdminTradingSettingsRow;

      // Calculate if within trading hours
      let withinTradingHours = true;
      if (typedSettings.trading_hours_enabled) {
        withinTradingHours = isWithinTradingHours(
          typedSettings.market_open_time,
          typedSettings.market_close_time,
          typedSettings.trading_timezone,
          typedSettings.trading_days || []
        );
      }

      // Market is closed if manually closed OR outside trading hours
      const isMarketClosed = typedSettings.market_closed || 
        (typedSettings.trading_hours_enabled && !withinTradingHours);

      setSettings({
        priceIntensity: typedSettings.price_intensity as PriceIntensity,
        isMarketClosed,
        canTrade: !isMarketClosed,
        tradingHoursEnabled: typedSettings.trading_hours_enabled || false,
        marketOpenTime: typedSettings.market_open_time || '09:30',
        marketCloseTime: typedSettings.market_close_time || '16:00',
        tradingTimezone: typedSettings.trading_timezone || 'America/New_York',
        tradingDays: typedSettings.trading_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching trading settings:', error);
      setSettings({ ...DEFAULT_SETTINGS, isLoading: false });
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSettings();

    // Re-check every minute for trading hours changes
    const interval = setInterval(fetchSettings, 60000);
    return () => clearInterval(interval);
  }, [fetchSettings]);

  return settings;
};

// Hook for admins to manage their own settings
export const useAdminTradingSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AdminTradingSettingsRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data } = await supabase
        .from('admin_trading_settings')
        .select('*')
        .eq('admin_id', user.id)
        .single();

      setSettings(data as AdminTradingSettingsRow | null);
    } catch {
      setSettings(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<AdminTradingSettingsRow>) => {
    if (!user?.id) return { error: 'Not authenticated' };

    try {
      if (settings) {
        // Update existing
        const { error } = await supabase
          .from('admin_trading_settings')
          .update(updates)
          .eq('admin_id', user.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('admin_trading_settings')
          .insert({ admin_id: user.id, ...updates });

        if (error) throw error;
      }

      await fetchSettings();
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  };

  return { settings, isLoading, updateSettings, refetch: fetchSettings };
};
