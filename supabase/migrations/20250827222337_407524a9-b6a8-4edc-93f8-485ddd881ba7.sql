-- First, let's drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS update_user_balance_on_trade_open_trigger ON public.trades;
DROP TRIGGER IF EXISTS update_user_balance_on_trade_close_trigger ON public.trades;
DROP TRIGGER IF EXISTS validate_user_balance_trigger ON public.user_profiles;

-- Recreate the trade open function with better logic
CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Only process when inserting a new open trade
  IF NEW.status = 'open' THEN
    -- Update user profile to reserve margin
    UPDATE public.user_profiles
    SET 
      used_margin = used_margin + NEW.margin_used,
      available_margin = GREATEST(balance - (used_margin + NEW.margin_used), 0)
    WHERE user_id = NEW.user_id;
    
    -- Log for debugging
    RAISE NOTICE 'Trade opened: user_id=%, margin_used=%, new_used_margin=%', 
      NEW.user_id, NEW.margin_used, (SELECT used_margin FROM public.user_profiles WHERE user_id = NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trade close function
CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  pnl_amount DECIMAL;
BEGIN
  -- Only process when trade status changes from open to closed
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    pnl_amount = NEW.pnl;
    
    -- Apply P&L to balance and release margin
    UPDATE public.user_profiles
    SET 
      balance = balance + pnl_amount,
      used_margin = GREATEST(used_margin - NEW.margin_used, 0),
      available_margin = (balance + pnl_amount) - GREATEST(used_margin - NEW.margin_used, 0),
      equity = balance + pnl_amount
    WHERE user_id = NEW.user_id;
    
    -- Log for debugging
    RAISE NOTICE 'Trade closed: user_id=%, pnl=%, margin_released=%', 
      NEW.user_id, pnl_amount, NEW.margin_used;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Simplified validate function that ensures consistency
CREATE OR REPLACE FUNCTION public.validate_user_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Ensure available_margin equals balance minus used_margin
  NEW.available_margin = GREATEST(NEW.balance - NEW.used_margin, 0);
  
  RETURN NEW;
END;
$function$;

-- Create the triggers in the correct order
CREATE TRIGGER update_user_balance_on_trade_open_trigger
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_open();

CREATE TRIGGER update_user_balance_on_trade_close_trigger
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_close();

CREATE TRIGGER validate_user_balance_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_balance();