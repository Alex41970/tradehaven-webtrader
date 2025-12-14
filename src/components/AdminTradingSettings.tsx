import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useAdminTradingSettings } from '@/hooks/useTradingSettings';
import { toast } from 'sonner';
import { Activity, Clock, Power, Gauge } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Central European (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

export const AdminTradingSettings: React.FC = () => {
  const { settings, isLoading, updateSettings } = useAdminTradingSettings();
  const [isSaving, setIsSaving] = useState(false);
  
  // Local state for form
  const [priceIntensity, setPriceIntensity] = useState('medium');
  const [marketClosed, setMarketClosed] = useState(false);
  const [tradingHoursEnabled, setTradingHoursEnabled] = useState(false);
  const [marketOpenTime, setMarketOpenTime] = useState('09:30');
  const [marketCloseTime, setMarketCloseTime] = useState('16:00');
  const [tradingTimezone, setTradingTimezone] = useState('America/New_York');
  const [tradingDays, setTradingDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);

  // Sync form state with fetched settings
  useEffect(() => {
    if (settings) {
      setPriceIntensity(settings.price_intensity || 'medium');
      setMarketClosed(settings.market_closed || false);
      setTradingHoursEnabled(settings.trading_hours_enabled || false);
      setMarketOpenTime(settings.market_open_time || '09:30');
      setMarketCloseTime(settings.market_close_time || '16:00');
      setTradingTimezone(settings.trading_timezone || 'America/New_York');
      setTradingDays(settings.trading_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateSettings({
      price_intensity: priceIntensity,
      market_closed: marketClosed,
      trading_hours_enabled: tradingHoursEnabled,
      market_open_time: marketOpenTime,
      market_close_time: marketCloseTime,
      trading_timezone: tradingTimezone,
      trading_days: tradingDays,
    });

    if (result.error) {
      toast.error('Failed to save settings: ' + result.error);
    } else {
      toast.success('Trading settings saved');
    }
    setIsSaving(false);
  };

  const handleDayToggle = (day: string) => {
    if (tradingDays.includes(day)) {
      setTradingDays(tradingDays.filter(d => d !== day));
    } else {
      setTradingDays([...tradingDays, day]);
    }
  };

  const handleMarketClosedToggle = async (closed: boolean) => {
    setMarketClosed(closed);
    // Immediately save this change
    const result = await updateSettings({ market_closed: closed });
    if (result.error) {
      toast.error('Failed to update market status');
      setMarketClosed(!closed); // Revert
    } else {
      toast.success(closed ? 'Market closed' : 'Market opened');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Trading Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Trading Controls
        </CardTitle>
        <CardDescription>
          Control price movement intensity and market hours for all your assigned users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Market Closed Toggle - Prominent */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <Power className={`h-5 w-5 ${marketClosed ? 'text-destructive' : 'text-green-500'}`} />
            <div>
              <Label className="text-base font-medium">Market Status</Label>
              <p className="text-sm text-muted-foreground">
                {marketClosed ? 'Trading is disabled for all users' : 'Trading is enabled'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${marketClosed ? 'text-destructive' : 'text-green-500'}`}>
              {marketClosed ? 'CLOSED' : 'OPEN'}
            </span>
            <Switch
              checked={!marketClosed}
              onCheckedChange={(checked) => handleMarketClosedToggle(!checked)}
            />
          </div>
        </div>

        {/* Price Intensity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <Label>Price Movement Intensity</Label>
          </div>
          <Select value={priceIntensity} onValueChange={setPriceIntensity}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off - No movement</SelectItem>
              <SelectItem value="low">Low - Slow updates (5s)</SelectItem>
              <SelectItem value="medium">Medium - Normal (2s)</SelectItem>
              <SelectItem value="high">High - Fast updates (1s)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Controls how often prices visually update for users between real data fetches
          </p>
        </div>

        {/* Trading Hours Section */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Label>Scheduled Trading Hours</Label>
            </div>
            <Switch
              checked={tradingHoursEnabled}
              onCheckedChange={setTradingHoursEnabled}
            />
          </div>

          {tradingHoursEnabled && (
            <div className="space-y-4 pl-6 animate-in slide-in-from-top-2">
              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Market Open</Label>
                  <Input
                    type="time"
                    value={marketOpenTime}
                    onChange={(e) => setMarketOpenTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Market Close</Label>
                  <Input
                    type="time"
                    value={marketCloseTime}
                    onChange={(e) => setMarketCloseTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <Label className="text-sm">Timezone</Label>
                <Select value={tradingTimezone} onValueChange={setTradingTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Trading Days */}
              <div className="space-y-2">
                <Label className="text-sm">Trading Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div
                      key={day.value}
                      className="flex items-center gap-1.5"
                    >
                      <Checkbox
                        id={day.value}
                        checked={tradingDays.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <Label
                        htmlFor={day.value}
                        className="text-sm cursor-pointer"
                      >
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
};
