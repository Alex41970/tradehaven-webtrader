-- Fix the auto_recalculate_user_margins function with proper permissions and run for all users
DROP FUNCTION IF EXISTS public.auto_recalculate_user_margins(uuid);

CREATE OR REPLACE FUNCTION public.auto_recalculate_user_margins(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Calculate total P&L from ALL closed trades (this was the bug)
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
    equity = new_balance, -- Equity equals balance for this calculation
    updated_at = now()
  WHERE user_id = _user_id;
  
  RAISE NOTICE 'Updated user profile: balance=%, used_margin=%, available_margin=%', 
    new_balance, total_used_margin, GREATEST(new_balance - total_used_margin, 0);
END;
$function$;

-- Create triggers to automatically recalculate margins on trade changes
CREATE OR REPLACE FUNCTION public.handle_trade_opened()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only process when inserting a new open trade
  IF NEW.status = 'open' THEN
    -- Recalculate margins for the user
    PERFORM public.auto_recalculate_user_margins(NEW.user_id);
    
    RAISE NOTICE 'Auto-recalculated margins for user % after opening trade %', NEW.user_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_trade_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only process when trade status changes from open to closed
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    -- Recalculate margins for the user
    PERFORM public.auto_recalculate_user_margins(NEW.user_id);
    
    RAISE NOTICE 'Auto-recalculated margins for user % after closing trade %', NEW.user_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_handle_trade_opened ON trades;
DROP TRIGGER IF EXISTS trigger_handle_trade_closed ON trades;

-- Create triggers
CREATE TRIGGER trigger_handle_trade_opened
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION handle_trade_opened();

CREATE TRIGGER trigger_handle_trade_closed
  AFTER UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION handle_trade_closed();

-- Run system-wide balance fix for ALL users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  RAISE NOTICE 'Starting system-wide balance recalculation for all users';
  
  -- Process each user with a profile
  FOR user_record IN SELECT DISTINCT user_id FROM user_profiles LOOP
    PERFORM public.auto_recalculate_user_margins(user_record.user_id);
    RAISE NOTICE 'Fixed balance for user: %', user_record.user_id;
  END LOOP;
  
  RAISE NOTICE 'Completed system-wide balance recalculation';
END $$;

-- Create balance validation function
CREATE OR REPLACE FUNCTION public.validate_margin_consistency()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_record RECORD;
  open_trades_count INTEGER;
BEGIN
  -- Check all users for margin inconsistencies
  FOR user_record IN 
    SELECT user_id, used_margin FROM user_profiles WHERE used_margin > 0
  LOOP
    -- Count open trades for this user
    SELECT COUNT(*) INTO open_trades_count
    FROM trades
    WHERE user_id = user_record.user_id AND status = 'open';
    
    -- If no open trades but has used margin, fix it
    IF open_trades_count = 0 AND user_record.used_margin > 0 THEN
      RAISE NOTICE 'Fixing margin inconsistency for user %', user_record.user_id;
      PERFORM public.auto_recalculate_user_margins(user_record.user_id);
    END IF;
  END LOOP;
END;
$function$;