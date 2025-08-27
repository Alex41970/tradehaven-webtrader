-- Create function to handle trade opening (reserve margin)
CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Reserve margin when opening a trade
  UPDATE public.user_profiles
  SET 
    used_margin = used_margin + NEW.margin_used,
    available_margin = available_margin - NEW.margin_used
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$function$

-- Create trigger for trade opening
CREATE TRIGGER update_user_balance_on_trade_open_trigger
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_open();

-- Fix the existing trade closing function
CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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
      used_margin = used_margin - NEW.margin_used,
      available_margin = available_margin + NEW.margin_used + pnl_amount,
      equity = balance + pnl_amount
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$function$

-- Reset user profile data to clean state (assuming single user for demo)
UPDATE public.user_profiles 
SET 
  balance = 10000.00,
  equity = 10000.00,
  used_margin = 0.00,
  available_margin = 10000.00
WHERE TRUE;