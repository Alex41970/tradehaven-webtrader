-- Fix PnL calculation to include leverage like the frontend
-- Update the calculate_pnl function to include leverage parameter
CREATE OR REPLACE FUNCTION public.calculate_pnl(trade_type text, amount numeric, open_price numeric, current_price numeric, leverage_param numeric DEFAULT 1)
RETURNS numeric
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Handle null/zero leverage by defaulting to 1
  IF leverage_param IS NULL OR leverage_param <= 0 THEN
    leverage_param := 1;
  END IF;

  IF trade_type = 'BUY' THEN
    RETURN amount * (current_price - open_price) * leverage_param;
  ELSE
    RETURN amount * (open_price - current_price) * leverage_param;
  END IF;
END;
$function$;

-- Recalculate PnL for all existing closed trades using correct formula with leverage
UPDATE public.trades 
SET pnl = public.calculate_pnl(
  trade_type, 
  amount, 
  open_price, 
  COALESCE(close_price, current_price), 
  COALESCE(leverage, 1)
)
WHERE status = 'closed';

-- Also update any open trades that have current PnL calculated
UPDATE public.trades 
SET pnl = public.calculate_pnl(
  trade_type, 
  amount, 
  open_price, 
  COALESCE(current_price, open_price), 
  COALESCE(leverage, 1)
)
WHERE status = 'open' AND current_price IS NOT NULL;