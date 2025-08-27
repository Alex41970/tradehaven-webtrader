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
$function$;