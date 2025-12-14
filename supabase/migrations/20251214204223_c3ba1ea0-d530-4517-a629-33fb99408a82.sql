-- Create admin_trading_settings table for trading controls per admin
CREATE TABLE public.admin_trading_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL UNIQUE,
  
  -- Price movement intensity: 'off' | 'low' | 'medium' | 'high'
  price_intensity TEXT NOT NULL DEFAULT 'medium',
  
  -- Market closed toggle (manual override)
  market_closed BOOLEAN NOT NULL DEFAULT false,
  
  -- Optional: Scheduled trading hours (timezone aware)
  trading_hours_enabled BOOLEAN DEFAULT false,
  market_open_time TIME DEFAULT '09:30',
  market_close_time TIME DEFAULT '16:00',
  trading_timezone TEXT DEFAULT 'America/New_York',
  trading_days TEXT[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday'],
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_trading_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage their own settings
CREATE POLICY "Admins can manage own trading settings" 
ON public.admin_trading_settings
FOR ALL 
USING (auth.uid() = admin_id OR has_role(auth.uid(), 'super_admin'::app_role));

-- Users can read their admin's settings
CREATE POLICY "Users can read their admin trading settings" 
ON public.admin_trading_settings
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM admin_user_relationships 
    WHERE admin_user_relationships.admin_id = admin_trading_settings.admin_id 
    AND admin_user_relationships.user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_admin_trading_settings_updated_at
BEFORE UPDATE ON public.admin_trading_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();