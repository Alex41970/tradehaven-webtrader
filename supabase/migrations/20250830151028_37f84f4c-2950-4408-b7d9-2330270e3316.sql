-- Create function to recalculate all user margins from actual trade data
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
  base_balance DECIMAL := 10000.00;
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

-- Create function to recalculate margins for a specific user
CREATE OR REPLACE FUNCTION public.recalculate_user_margins(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_used_margin DECIMAL := 0;
  total_closed_pnl DECIMAL := 0;
  base_balance DECIMAL := 10000.00;
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

-- Enhanced trade open trigger with better error handling
CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_open_enhanced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_balance DECIMAL;
  current_used_margin DECIMAL;
BEGIN
  -- Only process when inserting a new open trade
  IF NEW.status = 'open' THEN
    -- Get current user profile values
    SELECT balance, used_margin INTO current_balance, current_used_margin
    FROM user_profiles
    WHERE user_id = NEW.user_id;
    
    -- Validate sufficient margin
    IF (current_balance - current_used_margin) < NEW.margin_used THEN
      RAISE EXCEPTION 'Insufficient available margin. Required: %, Available: %', 
        NEW.margin_used, (current_balance - current_used_margin);
    END IF;
    
    -- Update user profile to reserve margin
    UPDATE user_profiles
    SET 
      used_margin = used_margin + NEW.margin_used,
      available_margin = GREATEST(balance - (used_margin + NEW.margin_used), 0),
      updated_at = now()
    WHERE user_id = NEW.user_id;
    
    RAISE NOTICE 'Trade opened successfully: trade_id=%, user_id=%, margin_used=%', 
      NEW.id, NEW.user_id, NEW.margin_used;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating balance on trade open: %', SQLERRM;
END;
$function$;

-- Enhanced trade close trigger with better error handling
CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_close_enhanced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pnl_amount DECIMAL;
BEGIN
  -- Only process when trade status changes from open to closed
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    pnl_amount := COALESCE(NEW.pnl, 0);
    
    -- Apply P&L to balance and release margin
    UPDATE user_profiles
    SET 
      balance = balance + pnl_amount,
      used_margin = GREATEST(used_margin - NEW.margin_used, 0),
      available_margin = GREATEST((balance + pnl_amount) - GREATEST(used_margin - NEW.margin_used, 0), 0),
      equity = balance + pnl_amount,
      updated_at = now()
    WHERE user_id = NEW.user_id;
    
    RAISE NOTICE 'Trade closed successfully: trade_id=%, user_id=%, pnl=%, margin_released=%', 
      NEW.id, NEW.user_id, pnl_amount, NEW.margin_used;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating balance on trade close: %', SQLERRM;
END;
$function$;

-- Drop old triggers if they exist
DROP TRIGGER IF EXISTS final_trade_open_trigger ON trades;
DROP TRIGGER IF EXISTS final_trade_close_trigger ON trades;

-- Create new enhanced triggers
CREATE TRIGGER enhanced_trade_open_trigger
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_user_balance_on_trade_open_enhanced();

CREATE TRIGGER enhanced_trade_close_trigger
  AFTER UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_user_balance_on_trade_close_enhanced();

-- Execute the repair function to fix existing data
SELECT recalculate_all_user_margins();