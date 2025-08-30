-- Continue fixing remaining database functions with search_path protection

CREATE OR REPLACE FUNCTION public.admin_close_trade(_admin_id uuid, _trade_id uuid, _close_price numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  _trade_user_id UUID;
  _trade_record RECORD;
  _pnl_amount DECIMAL;
BEGIN
  -- Get the trade details
  SELECT user_id, trade_type, amount, open_price, leverage, margin_used, status
  INTO _trade_record
  FROM trades
  WHERE id = _trade_id;
  
  -- Check if trade exists and is open
  IF _trade_record IS NULL THEN
    RETURN false;
  END IF;
  
  IF _trade_record.status != 'open' THEN
    RETURN false;
  END IF;
  
  -- Verify admin has access to this user's trades
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _trade_record.user_id
  ) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN false;
  END IF;
  
  -- Calculate P&L
  _pnl_amount = calculate_pnl(
    _trade_record.trade_type, 
    _trade_record.amount, 
    _trade_record.open_price, 
    _close_price,
    _trade_record.leverage
  );
  
  -- Close the trade
  UPDATE trades
  SET 
    status = 'closed',
    close_price = _close_price,
    pnl = _pnl_amount,
    closed_at = now()
  WHERE id = _trade_id;
  
  -- Update user balance (release margin and apply P&L)
  UPDATE user_profiles
  SET 
    balance = balance + _pnl_amount,
    used_margin = GREATEST(used_margin - _trade_record.margin_used, 0),
    available_margin = (balance + _pnl_amount) - GREATEST(used_margin - _trade_record.margin_used, 0),
    equity = balance + _pnl_amount
  WHERE user_id = _trade_record.user_id;
  
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_bot_license(_admin_id uuid, _expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
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
  INSERT INTO bot_licenses (license_key, admin_id, expires_at)
  VALUES (_license_key, _admin_id, _expires_at);
  
  RETURN _license_key;
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_bot_license(_user_id uuid, _license_key text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  _license RECORD;
BEGIN
  -- Check if license exists and is valid
  SELECT * INTO _license
  FROM bot_licenses
  WHERE license_key = _license_key
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND used_by_user_id IS NULL;
  
  IF _license IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired license key');
  END IF;
  
  -- Check if user already has an active bot
  IF EXISTS (SELECT 1 FROM user_bot_status WHERE user_id = _user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User already has an active bot connection');
  END IF;
  
  -- Activate license for user
  UPDATE bot_licenses
  SET used_by_user_id = _user_id, updated_at = now()
  WHERE license_key = _license_key;
  
  -- Create bot status record
  INSERT INTO user_bot_status (user_id, license_key)
  VALUES (_user_id, _license_key);
  
  RETURN json_build_object('success', true, 'message', 'Bot license activated successfully');
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_trade(_admin_id uuid, _user_id uuid, _asset_id uuid, _symbol text, _trade_type text, _amount numeric, _leverage integer, _open_price numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  _user_profile RECORD;
  _asset_record RECORD;
  _margin_required NUMERIC;
  _trade_id UUID;
BEGIN
  -- Verify admin has access to this user
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _user_id
  ) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied to this user');
  END IF;
  
  -- Get user profile
  SELECT balance, used_margin, available_margin
  INTO _user_profile
  FROM user_profiles
  WHERE user_id = _user_id;
  
  IF _user_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  -- Get asset details
  SELECT min_trade_size, max_leverage, is_active
  INTO _asset_record
  FROM assets
  WHERE id = _asset_id;
  
  IF _asset_record IS NULL OR NOT _asset_record.is_active THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or inactive asset');
  END IF;
  
  -- Validate trade parameters
  IF _amount < _asset_record.min_trade_size THEN
    RETURN json_build_object('success', false, 'error', 'Amount below minimum trade size');
  END IF;
  
  IF _leverage > _asset_record.max_leverage THEN
    RETURN json_build_object('success', false, 'error', 'Leverage exceeds maximum allowed');
  END IF;
  
  IF _trade_type NOT IN ('BUY', 'SELL') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid trade type');
  END IF;
  
  -- Calculate margin required
  _margin_required = _amount * _open_price / _leverage;
  
  -- Check if user has sufficient margin
  IF _user_profile.available_margin < _margin_required THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient margin available');
  END IF;
  
  -- Create the trade (marked as bot trade)
  INSERT INTO trades (
    user_id,
    asset_id,
    symbol,
    trade_type,
    amount,
    leverage,
    open_price,
    current_price,
    margin_used,
    status,
    trade_source
  ) VALUES (
    _user_id,
    _asset_id,
    _symbol,
    _trade_type,
    _amount,
    _leverage,
    _open_price,
    _open_price,
    _margin_required,
    'open',
    'bot'
  ) RETURNING id INTO _trade_id;
  
  -- Update user margin (this will be handled by the trigger, but we return the expected state)
  RETURN json_build_object(
    'success', true, 
    'trade_id', _trade_id,
    'margin_used', _margin_required,
    'message', 'Bot trade created successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Insert user profile with metadata
  INSERT INTO user_profiles (
    user_id, 
    email, 
    first_name,
    surname,
    phone_number,
    balance, 
    equity, 
    available_margin
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'surname',
    NEW.raw_user_meta_data ->> 'phone_number',
    10000.00,
    10000.00,
    10000.00
  );
  
  -- Insert default user role
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_pnl(trade_type text, amount numeric, open_price numeric, current_price numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  IF trade_type = 'BUY' THEN
    RETURN amount * (current_price - open_price);
  ELSE
    RETURN amount * (open_price - current_price);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_open_safe()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Only process when inserting a new open trade
  IF NEW.status = 'open' THEN
    -- Update user profile to reserve margin (idempotent operation)
    UPDATE user_profiles
    SET 
      used_margin = used_margin + NEW.margin_used,
      available_margin = GREATEST(balance - (used_margin + NEW.margin_used), 0)
    WHERE user_id = NEW.user_id;
    
    -- Log for debugging with unique trade identifier
    RAISE NOTICE 'SAFE Trade opened: trade_id=%, user_id=%, margin_used=%', 
      NEW.id, NEW.user_id, NEW.margin_used;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_close_safe()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  pnl_amount DECIMAL;
BEGIN
  -- Only process when trade status changes from open to closed
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    pnl_amount = NEW.pnl;
    
    -- Apply P&L to balance and release margin (idempotent operation)
    UPDATE user_profiles
    SET 
      balance = balance + pnl_amount,
      used_margin = GREATEST(used_margin - NEW.margin_used, 0),
      available_margin = (balance + pnl_amount) - GREATEST(used_margin - NEW.margin_used, 0),
      equity = balance + pnl_amount
    WHERE user_id = NEW.user_id;
    
    -- Log for debugging with unique trade identifier
    RAISE NOTICE 'SAFE Trade closed: trade_id=%, user_id=%, pnl=%, margin_released=%', 
      NEW.id, NEW.user_id, pnl_amount, NEW.margin_used;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_user_balance(user_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  closed_pnl DECIMAL := 0;
  used_margin_total DECIMAL := 0;
  base_balance DECIMAL := 10000.00;
BEGIN
  -- Calculate total P&L from closed trades
  SELECT COALESCE(SUM(pnl), 0) INTO closed_pnl
  FROM trades
  WHERE user_id = user_uuid AND status = 'closed';
  
  -- Calculate total margin used by open trades
  SELECT COALESCE(SUM(margin_used), 0) INTO used_margin_total
  FROM trades
  WHERE user_id = user_uuid AND status = 'open';
  
  -- Update user profile with correct values
  UPDATE user_profiles
  SET 
    balance = base_balance + closed_pnl,
    used_margin = used_margin_total,
    available_margin = GREATEST((base_balance + closed_pnl) - used_margin_total, 0),
    equity = base_balance + closed_pnl
  WHERE user_id = user_uuid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_user_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  -- Ensure available_margin equals balance minus used_margin
  NEW.available_margin = GREATEST(NEW.balance - NEW.used_margin, 0);
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_pnl(trade_type text, amount numeric, open_price numeric, current_price numeric, leverage_param numeric DEFAULT 1)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  -- Handle null/zero leverage by defaulting to 1
  IF leverage_param IS NULL OR leverage_param <= 0 THEN
    leverage_param := 1;
  END IF;

  IF trade_type = 'BUY' THEN
    RETURN amount * (current_price - open_price) * leverage_param;
  ELSE
    RETURN amount * (open_price - current_price) * leverage_param;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT role
  FROM user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'user' THEN 3
    END
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.admin_modify_user_balance(_admin_id uuid, _user_id uuid, _amount numeric, _operation text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Verify admin has access to this user
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _user_id
  ) AND NOT has_role(_admin_id, 'super_admin') THEN
    RETURN false;
  END IF;
  
  -- Modify balance
  IF _operation = 'add' THEN
    UPDATE user_profiles
    SET balance = balance + _amount,
        equity = equity + _amount,
        available_margin = available_margin + _amount
    WHERE user_id = _user_id;
  ELSIF _operation = 'deduct' THEN
    UPDATE user_profiles
    SET balance = GREATEST(balance - _amount, 0),
        equity = GREATEST(equity - _amount, 0),
        available_margin = GREATEST(available_margin - _amount, 0)
    WHERE user_id = _user_id;
  END IF;
  
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_modify_trade_open_price(_admin_id uuid, _trade_id uuid, _new_open_price numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  _trade_user_id UUID;
BEGIN
  -- Get the user_id for this trade
  SELECT user_id INTO _trade_user_id
  FROM trades
  WHERE id = _trade_id;
  
  -- Verify admin has access to this user's trades
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _trade_user_id
  ) AND NOT has_role(_admin_id, 'super_admin') THEN
    RETURN false;
  END IF;
  
  -- Update trade open price
  UPDATE trades
  SET open_price = _new_open_price
  WHERE id = _trade_id;
  
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Insert default user role
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;