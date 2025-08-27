-- Fix all remaining functions with security path issues

-- Drop old unused functions that are no longer needed
DROP FUNCTION IF EXISTS public.update_user_balance_on_trade_close() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_balance_on_trade_open() CASCADE;

-- Fix all remaining functions to have proper search_path
CREATE OR REPLACE FUNCTION public.calculate_pnl(trade_type text, amount numeric, open_price numeric, current_price numeric)
RETURNS numeric
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF trade_type = 'BUY' THEN
    RETURN amount * (current_price - open_price);
  ELSE
    RETURN amount * (open_price - current_price);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, balance, equity, available_margin)
  VALUES (
    NEW.id,
    NEW.email,
    10000.00,
    10000.00,
    10000.00
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_user_balance(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_user_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure available_margin equals balance minus used_margin
  NEW.available_margin = GREATEST(NEW.balance - NEW.used_margin, 0);
  
  RETURN NEW;
END;
$function$;