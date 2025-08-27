-- Fix the trade close trigger function
CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  pnl_amount DECIMAL;
BEGIN
  -- Only process when trade status changes to 'closed'
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    pnl_amount = NEW.pnl;
    
    -- Release margin and apply P&L to balance
    UPDATE public.user_profiles
    SET 
      balance = balance + pnl_amount,
      used_margin = GREATEST(used_margin - NEW.margin_used, 0),
      available_margin = available_margin + NEW.margin_used,
      equity = balance + pnl_amount
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix the trade open trigger function
CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Reserve margin when opening a trade
  UPDATE public.user_profiles
  SET 
    used_margin = used_margin + NEW.margin_used,
    available_margin = GREATEST(available_margin - NEW.margin_used, 0)
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$function$;

-- Create triggers if they don't exist
DROP TRIGGER IF EXISTS update_balance_on_trade_close ON public.trades;
CREATE TRIGGER update_balance_on_trade_close
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_close();

DROP TRIGGER IF EXISTS update_balance_on_trade_open ON public.trades;
CREATE TRIGGER update_balance_on_trade_open
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_open();

-- Create function to recalculate user balance
CREATE OR REPLACE FUNCTION public.recalculate_user_balance(user_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  closed_pnl DECIMAL := 0;
  used_margin_total DECIMAL := 0;
  base_balance DECIMAL := 10000.00;
BEGIN
  -- Calculate total P&L from closed trades
  SELECT COALESCE(SUM(pnl), 0) INTO closed_pnl
  FROM public.trades
  WHERE user_id = user_uuid AND status = 'closed';
  
  -- Calculate total margin used by open trades
  SELECT COALESCE(SUM(margin_used), 0) INTO used_margin_total
  FROM public.trades
  WHERE user_id = user_uuid AND status = 'open';
  
  -- Update user profile with correct values
  UPDATE public.user_profiles
  SET 
    balance = base_balance + closed_pnl,
    used_margin = used_margin_total,
    available_margin = GREATEST((base_balance + closed_pnl) - used_margin_total, 0),
    equity = base_balance + closed_pnl
  WHERE user_id = user_uuid;
END;
$function$;