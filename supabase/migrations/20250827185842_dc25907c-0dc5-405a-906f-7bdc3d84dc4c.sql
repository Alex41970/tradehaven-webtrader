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
$function$;