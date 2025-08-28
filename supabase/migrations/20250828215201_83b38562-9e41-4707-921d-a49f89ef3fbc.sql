-- Create bot licenses table for admin-generated license keys
CREATE TABLE public.bot_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_key TEXT NOT NULL UNIQUE,
  admin_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  used_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user bot status table to track bot connections
CREATE TABLE public.user_bot_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  license_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  bot_status TEXT NOT NULL DEFAULT 'active' CHECK (bot_status IN ('active', 'paused')),
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  permissions JSONB NOT NULL DEFAULT '{"trade_execution": true, "history_access": true, "analytics_access": true}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.bot_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bot_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for bot_licenses
CREATE POLICY "Admins can manage their own licenses"
ON public.bot_licenses
FOR ALL
USING (
  auth.uid() = admin_id OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Users can view licenses they're using"
ON public.bot_licenses
FOR SELECT
USING (
  auth.uid() = used_by_user_id OR
  auth.uid() = admin_id OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- RLS policies for user_bot_status
CREATE POLICY "Users can manage their own bot status"
ON public.user_bot_status
FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view their users' bot status"
ON public.user_bot_status
FOR SELECT
USING (
  auth.uid() = user_id OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = auth.uid() AND user_id = user_bot_status.user_id
  )
);

-- Function to generate license keys
CREATE OR REPLACE FUNCTION public.generate_bot_license(_admin_id UUID, _expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _license_key TEXT;
BEGIN
  -- Verify user is admin
  IF NOT has_role(_admin_id, 'admin'::app_role) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can generate license keys';
  END IF;
  
  -- Generate unique license key
  _license_key := 'TBL-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)) || '-' || 
                  upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)) || '-' ||
                  upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  
  -- Insert license
  INSERT INTO public.bot_licenses (license_key, admin_id, expires_at)
  VALUES (_license_key, _admin_id, _expires_at);
  
  RETURN _license_key;
END;
$$;

-- Function to validate and activate license
CREATE OR REPLACE FUNCTION public.activate_bot_license(_user_id UUID, _license_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _license RECORD;
BEGIN
  -- Check if license exists and is valid
  SELECT * INTO _license
  FROM public.bot_licenses
  WHERE license_key = _license_key
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND used_by_user_id IS NULL;
  
  IF _license IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired license key');
  END IF;
  
  -- Check if user already has an active bot
  IF EXISTS (SELECT 1 FROM public.user_bot_status WHERE user_id = _user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User already has an active bot connection');
  END IF;
  
  -- Activate license for user
  UPDATE public.bot_licenses
  SET used_by_user_id = _user_id, updated_at = now()
  WHERE license_key = _license_key;
  
  -- Create bot status record
  INSERT INTO public.user_bot_status (user_id, license_key)
  VALUES (_user_id, _license_key);
  
  RETURN json_build_object('success', true, 'message', 'Bot license activated successfully');
END;
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_bot_licenses_updated_at
  BEFORE UPDATE ON public.bot_licenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_bot_status_updated_at
  BEFORE UPDATE ON public.user_bot_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();