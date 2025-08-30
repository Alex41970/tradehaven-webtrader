-- Create robust database triggers for automatic margin management

-- First, create an improved margin recalculation function
CREATE OR REPLACE FUNCTION public.auto_recalculate_user_margins(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_used_margin DECIMAL := 0;
  total_closed_pnl DECIMAL := 0;
  base_balance DECIMAL := 10000.00;
  new_balance DECIMAL;
BEGIN
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
END;
$$;

-- Create trigger function for trade insertion (opening trades)
CREATE OR REPLACE FUNCTION public.handle_trade_opened()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only process when inserting a new open trade
  IF NEW.status = 'open' THEN
    -- Recalculate margins for the user
    PERFORM public.auto_recalculate_user_margins(NEW.user_id);
    
    RAISE NOTICE 'Auto-recalculated margins for user % after opening trade %', NEW.user_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger function for trade updates (closing trades)
CREATE OR REPLACE FUNCTION public.handle_trade_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only process when trade status changes from open to closed
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    -- Recalculate margins for the user
    PERFORM public.auto_recalculate_user_margins(NEW.user_id);
    
    RAISE NOTICE 'Auto-recalculated margins for user % after closing trade %', NEW.user_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers on the trades table
CREATE TRIGGER trigger_trade_opened
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_trade_opened();

CREATE TRIGGER trigger_trade_closed
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_trade_closed();

-- Create a function to validate margin consistency
CREATE OR REPLACE FUNCTION public.validate_margin_consistency()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;