-- Change starting balance from $10,000 to $0 for new users

-- 1. Update table column defaults to $0
ALTER TABLE user_profiles 
ALTER COLUMN balance SET DEFAULT 0.00,
ALTER COLUMN equity SET DEFAULT 0.00,
ALTER COLUMN available_margin SET DEFAULT 0.00;

-- 2. Update the handle_new_user function to use $0 starting balance
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert user profile with $0 starting balance
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
    0.00,
    0.00,
    0.00
  );
  
  -- Insert default user role
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;

-- 3. Update all calculation functions to use $0 base balance

CREATE OR REPLACE FUNCTION public.auto_recalculate_user_margins(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_used_margin DECIMAL := 0;
  total_closed_pnl DECIMAL := 0;
  base_balance DECIMAL := 0.00;  -- Changed from 10000.00 to 0.00
  new_balance DECIMAL;
  trade_count INTEGER;
BEGIN
  -- Debug logging
  RAISE NOTICE 'Starting margin recalculation for user: %', _user_id;
  
  -- Calculate total margin used by open trades
  SELECT COALESCE(SUM(margin_used), 0), COUNT(*) 
  INTO total_used_margin, trade_count
  FROM trades
  WHERE user_id = _user_id AND status = 'open';
  
  RAISE NOTICE 'Open trades: count=%, total_used_margin=%', trade_count, total_used_margin;
  
  -- Calculate total P&L from ALL closed trades
  SELECT COALESCE(SUM(pnl), 0), COUNT(*) 
  INTO total_closed_pnl, trade_count
  FROM trades
  WHERE user_id = _user_id AND status = 'closed';
  
  RAISE NOTICE 'Closed trades: count=%, total_pnl=%', trade_count, total_closed_pnl;
  
  -- Calculate new balance = base balance + all closed P&L
  new_balance := base_balance + total_closed_pnl;
  
  RAISE NOTICE 'Calculated balance: base=% + pnl=% = %', base_balance, total_closed_pnl, new_balance;
  
  -- Update user profile with correct values
  UPDATE user_profiles
  SET 
    balance = new_balance,
    used_margin = total_used_margin,
    available_margin = GREATEST(new_balance - total_used_margin, 0),
    equity = new_balance,
    updated_at = now()
  WHERE user_id = _user_id;
  
  RAISE NOTICE 'Updated user profile: balance=%, used_margin=%, available_margin=%', 
    new_balance, total_used_margin, GREATEST(new_balance - total_used_margin, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_user_balance(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  closed_pnl DECIMAL := 0;
  used_margin_total DECIMAL := 0;
  base_balance DECIMAL := 0.00;  -- Changed from 10000.00 to 0.00
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

CREATE OR REPLACE FUNCTION public.recalculate_user_margins(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_used_margin DECIMAL := 0;
  total_closed_pnl DECIMAL := 0;
  base_balance DECIMAL := 0.00;  -- Changed from 10000.00 to 0.00
  new_balance DECIMAL;
  current_profile RECORD;
BEGIN
  -- Get current profile
  SELECT * INTO current_profile FROM user_profiles WHERE user_id = _user_id;
  
  IF current_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  -- Calculate total margin used by open trades
  SELECT COALESCE(SUM(margin_used), 0) INTO total_used_margin
  FROM trades
  WHERE user_id = _user_id AND status = 'open';
  
  -- Calculate total P&L from closed trades
  SELECT COALESCE(SUM(pnl), 0) INTO total_closed_pnl
  FROM trades
  WHERE user_id = _user_id AND status = 'closed';
  
  -- Calculate new balance
  new_balance := base_balance + total_closed_pnl;
  
  -- Update user profile with correct values
  UPDATE user_profiles
  SET 
    balance = new_balance,
    used_margin = total_used_margin,
    available_margin = GREATEST(new_balance - total_used_margin, 0),
    equity = new_balance,
    updated_at = now()
  WHERE user_id = _user_id;
  
  RETURN json_build_object(
    'success', true,
    'balance', new_balance,
    'used_margin', total_used_margin,
    'available_margin', GREATEST(new_balance - total_used_margin, 0),
    'equity', new_balance
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_all_user_margins()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_record RECORD;
  total_used_margin DECIMAL;
  total_closed_pnl DECIMAL;
  base_balance DECIMAL := 0.00;  -- Changed from 10000.00 to 0.00
  new_balance DECIMAL;
BEGIN
  RAISE NOTICE 'Starting margin recalculation for all users';
  
  -- Process each user
  FOR user_record IN SELECT DISTINCT user_id FROM user_profiles LOOP
    -- Calculate total margin used by open trades
    SELECT COALESCE(SUM(margin_used), 0) INTO total_used_margin
    FROM trades
    WHERE user_id = user_record.user_id AND status = 'open';
    
    -- Calculate total P&L from closed trades
    SELECT COALESCE(SUM(pnl), 0) INTO total_closed_pnl
    FROM trades
    WHERE user_id = user_record.user_id AND status = 'closed';
    
    -- Calculate new balance
    new_balance := base_balance + total_closed_pnl;
    
    -- Update user profile with correct values
    UPDATE user_profiles
    SET 
      balance = new_balance,
      used_margin = total_used_margin,
      available_margin = GREATEST(new_balance - total_used_margin, 0),
      equity = new_balance,
      updated_at = now()
    WHERE user_id = user_record.user_id;
    
    RAISE NOTICE 'Updated user %: balance=%, used_margin=%, available_margin=%', 
      user_record.user_id, new_balance, total_used_margin, GREATEST(new_balance - total_used_margin, 0);
  END LOOP;
  
  RAISE NOTICE 'Completed margin recalculation for all users';
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_user_margins(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  profile_record RECORD;
  calculated_used_margin DECIMAL := 0;
  calculated_closed_pnl DECIMAL := 0;
  calculated_balance DECIMAL;
  base_balance DECIMAL := 0.00;  -- Changed from 10000.00 to 0.00
  is_consistent BOOLEAN := true;
  issues TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Get current profile data
  SELECT balance, used_margin, available_margin, equity
  INTO profile_record
  FROM user_profiles
  WHERE user_id = _user_id;
  
  IF profile_record IS NULL THEN
    RETURN json_build_object('error', 'User profile not found');
  END IF;
  
  -- Calculate what the values should be
  SELECT COALESCE(SUM(margin_used), 0) INTO calculated_used_margin
  FROM trades WHERE user_id = _user_id AND status = 'open';
  
  SELECT COALESCE(SUM(pnl), 0) INTO calculated_closed_pnl
  FROM trades WHERE user_id = _user_id AND status = 'closed';
  
  calculated_balance := base_balance + calculated_closed_pnl;
  
  -- Check for inconsistencies
  IF profile_record.used_margin != calculated_used_margin THEN
    is_consistent := false;
    issues := array_append(issues, format('Used margin mismatch: stored=%s, calculated=%s', profile_record.used_margin, calculated_used_margin));
  END IF;
  
  IF profile_record.balance != calculated_balance THEN
    is_consistent := false;
    issues := array_append(issues, format('Balance mismatch: stored=%s, calculated=%s', profile_record.balance, calculated_balance));
  END IF;
  
  IF profile_record.available_margin != GREATEST(calculated_balance - calculated_used_margin, 0) THEN
    is_consistent := false;
    issues := array_append(issues, format('Available margin mismatch: stored=%s, calculated=%s', profile_record.available_margin, GREATEST(calculated_balance - calculated_used_margin, 0)));
  END IF;
  
  RETURN json_build_object(
    'user_id', _user_id,
    'is_consistent', is_consistent,
    'current_profile', json_build_object(
      'balance', profile_record.balance,
      'used_margin', profile_record.used_margin,
      'available_margin', profile_record.available_margin,
      'equity', profile_record.equity
    ),
    'calculated_values', json_build_object(
      'balance', calculated_balance,
      'used_margin', calculated_used_margin,
      'available_margin', GREATEST(calculated_balance - calculated_used_margin, 0),
      'equity', calculated_balance
    ),
    'issues', issues
  );
END;
$function$;