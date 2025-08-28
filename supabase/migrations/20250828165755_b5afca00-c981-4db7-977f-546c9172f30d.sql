-- Fix search path security issue for admin_close_trade function
CREATE OR REPLACE FUNCTION public.admin_close_trade(_admin_id uuid, _trade_id uuid, _close_price numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _trade_user_id UUID;
  _trade_record RECORD;
  _pnl_amount DECIMAL;
BEGIN
  -- Get the trade details
  SELECT user_id, trade_type, amount, open_price, leverage, margin_used, status
  INTO _trade_record
  FROM public.trades
  WHERE id = _trade_id;
  
  -- Check if trade exists and is open
  IF _trade_record IS NULL THEN
    RETURN false;
  END IF;
  
  IF _trade_record.status != 'open' THEN
    RETURN false;
  END IF;
  
  -- Verify admin has access to this user's trades
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _trade_record.user_id
  ) AND NOT public.has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN false;
  END IF;
  
  -- Calculate P&L
  _pnl_amount = public.calculate_pnl(
    _trade_record.trade_type, 
    _trade_record.amount, 
    _trade_record.open_price, 
    _close_price,
    _trade_record.leverage
  );
  
  -- Close the trade
  UPDATE public.trades
  SET 
    status = 'closed',
    close_price = _close_price,
    pnl = _pnl_amount,
    closed_at = now()
  WHERE id = _trade_id;
  
  -- Update user balance (release margin and apply P&L)
  UPDATE public.user_profiles
  SET 
    balance = balance + _pnl_amount,
    used_margin = GREATEST(used_margin - _trade_record.margin_used, 0),
    available_margin = (balance + _pnl_amount) - GREATEST(used_margin - _trade_record.margin_used, 0),
    equity = balance + _pnl_amount
  WHERE user_id = _trade_record.user_id;
  
  RETURN true;
END;
$function$