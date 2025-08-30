-- Fix missing database triggers for automatic margin calculations

-- First, ensure we have the correct trigger functions with proper permissions
CREATE OR REPLACE FUNCTION public.handle_trade_opened()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only process when inserting a new open trade
  IF NEW.status = 'open' THEN
    -- Log the trigger execution
    RAISE NOTICE 'TRIGGER: Trade opened - trade_id: %, user_id: %, margin_used: %', NEW.id, NEW.user_id, NEW.margin_used;
    
    -- Recalculate margins for the user
    PERFORM public.auto_recalculate_user_margins(NEW.user_id);
    
    RAISE NOTICE 'TRIGGER: Completed margin recalculation for user % after opening trade %', NEW.user_id, NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TRIGGER ERROR in handle_trade_opened: %', SQLERRM;
    RETURN NEW; -- Don't block the trade insertion
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_trade_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only process when trade status changes from open to closed
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    -- Log the trigger execution
    RAISE NOTICE 'TRIGGER: Trade closed - trade_id: %, user_id: %, pnl: %', NEW.id, NEW.user_id, NEW.pnl;
    
    -- Recalculate margins for the user
    PERFORM public.auto_recalculate_user_margins(NEW.user_id);
    
    RAISE NOTICE 'TRIGGER: Completed margin recalculation for user % after closing trade %', NEW.user_id, NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TRIGGER ERROR in handle_trade_closed: %', SQLERRM;
    RETURN NEW; -- Don't block the trade update
END;
$$;

-- Drop existing triggers if they exist (to avoid conflicts)
DROP TRIGGER IF EXISTS tr_handle_trade_opened ON public.trades;
DROP TRIGGER IF EXISTS tr_handle_trade_closed ON public.trades;

-- Create the triggers on the trades table
CREATE TRIGGER tr_handle_trade_opened
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_trade_opened();

CREATE TRIGGER tr_handle_trade_closed
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_trade_closed();

-- Ensure the auto_recalculate_user_margins function has proper permissions
CREATE OR REPLACE FUNCTION public.auto_recalculate_user_margins(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  total_used_margin DECIMAL := 0;
  total_closed_pnl DECIMAL := 0;
  base_balance DECIMAL := 10000.00;
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
$$;

-- Run a system-wide balance recalculation to fix all existing users
DO $$
DECLARE
  user_record RECORD;
  total_users INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting system-wide balance recalculation...';
  
  FOR user_record IN 
    SELECT DISTINCT user_id FROM user_profiles 
  LOOP
    total_users := total_users + 1;
    PERFORM public.auto_recalculate_user_margins(user_record.user_id);
    RAISE NOTICE 'Processed user %: %', total_users, user_record.user_id;
  END LOOP;
  
  RAISE NOTICE 'Completed system-wide recalculation for % users', total_users;
END;
$$;

-- Create a validation function to check margin consistency
CREATE OR REPLACE FUNCTION public.validate_user_margins(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  profile_record RECORD;
  calculated_used_margin DECIMAL := 0;
  calculated_closed_pnl DECIMAL := 0;
  calculated_balance DECIMAL;
  base_balance DECIMAL := 10000.00;
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
$$;