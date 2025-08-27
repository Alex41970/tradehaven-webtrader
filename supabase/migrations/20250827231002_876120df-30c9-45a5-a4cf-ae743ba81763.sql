-- Fix security warning: Function Search Path Mutable
-- Update the new functions to have proper search_path settings

CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_open_safe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only process when inserting a new open trade
  IF NEW.status = 'open' THEN
    -- Update user profile to reserve margin (idempotent operation)
    UPDATE public.user_profiles
    SET 
      used_margin = used_margin + NEW.margin_used,
      available_margin = GREATEST(balance - (used_margin + NEW.margin_used), 0)
    WHERE user_id = NEW.user_id;
    
    -- Log for debugging with unique trade identifier
    RAISE NOTICE 'SAFE Trade opened: trade_id=%, user_id=%, margin_used=%', 
      NEW.id, NEW.user_id, NEW.margin_used;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_close_safe()
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
    pnl_amount = NEW.pnl;
    
    -- Apply P&L to balance and release margin (idempotent operation)
    UPDATE public.user_profiles
    SET 
      balance = balance + pnl_amount,
      used_margin = GREATEST(used_margin - NEW.margin_used, 0),
      available_margin = (balance + pnl_amount) - GREATEST(used_margin - NEW.margin_used, 0),
      equity = balance + pnl_amount
    WHERE user_id = NEW.user_id;
    
    -- Log for debugging with unique trade identifier
    RAISE NOTICE 'SAFE Trade closed: trade_id=%, user_id=%, pnl=%, margin_released=%', 
      NEW.id, NEW.user_id, pnl_amount, NEW.margin_used;
  END IF;
  
  RETURN NEW;
END;
$function$;