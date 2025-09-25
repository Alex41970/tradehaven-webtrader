-- Fix account balance vs equity logic
-- Balance should be static (only closed trades), Equity should be dynamic (balance + unrealized P&L)

CREATE OR REPLACE FUNCTION public.auto_recalculate_user_margins(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_used_margin DECIMAL := 0;
  total_closed_pnl DECIMAL := 0;
  base_balance DECIMAL := 0.00;
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
  
  -- Calculate new balance = base balance + all closed P&L (STATIC - only closed trades)
  new_balance := base_balance + total_closed_pnl;
  
  RAISE NOTICE 'Calculated balance: base=% + pnl=% = %', base_balance, total_closed_pnl, new_balance;
  
  -- Update user profile - balance is STATIC, equity will be calculated in frontend
  UPDATE user_profiles
  SET 
    balance = new_balance,  -- Static: base + closed P&L only
    used_margin = total_used_margin,
    available_margin = GREATEST(new_balance - total_used_margin, 0),
    -- equity removed - will be calculated dynamically in frontend as balance + unrealized P&L
    updated_at = now()
  WHERE user_id = _user_id;
  
  RAISE NOTICE 'Updated user profile: balance=%, used_margin=%, available_margin=%', 
    new_balance, total_used_margin, GREATEST(new_balance - total_used_margin, 0);
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
  base_balance DECIMAL := 0.00;
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
  
  -- Calculate total P&L from closed trades only
  SELECT COALESCE(SUM(pnl), 0) INTO total_closed_pnl
  FROM trades
  WHERE user_id = _user_id AND status = 'closed';
  
  -- Calculate new balance = base + closed P&L (STATIC)
  new_balance := base_balance + total_closed_pnl;
  
  -- Update user profile with correct values
  UPDATE user_profiles
  SET 
    balance = new_balance,  -- Static: only closed trades
    used_margin = total_used_margin,
    available_margin = GREATEST(new_balance - total_used_margin, 0),
    -- equity removed - calculated dynamically in frontend
    updated_at = now()
  WHERE user_id = _user_id;
  
  RETURN json_build_object(
    'success', true,
    'balance', new_balance,
    'used_margin', total_used_margin,
    'available_margin', GREATEST(new_balance - total_used_margin, 0)
  );
END;
$function$;

-- Also fix the recalculate_all_user_margins function
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
  base_balance DECIMAL := 0.00;
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
    
    -- Calculate new balance (STATIC - only closed trades)
    new_balance := base_balance + total_closed_pnl;
    
    -- Update user profile with correct values
    UPDATE user_profiles
    SET 
      balance = new_balance,  -- Static: only closed trades
      used_margin = total_used_margin,
      available_margin = GREATEST(new_balance - total_used_margin, 0),
      -- equity removed - calculated dynamically in frontend
      updated_at = now()
    WHERE user_id = user_record.user_id;
    
    RAISE NOTICE 'Updated user %: balance=%, used_margin=%, available_margin=%', 
      user_record.user_id, new_balance, total_used_margin, GREATEST(new_balance - total_used_margin, 0);
  END LOOP;
  
  RAISE NOTICE 'Completed margin recalculation for all users';
END;
$function$;