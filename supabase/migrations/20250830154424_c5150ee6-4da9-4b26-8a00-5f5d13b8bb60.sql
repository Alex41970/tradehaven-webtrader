-- Fix the auto_recalculate_user_margins function to properly calculate and apply P&L
CREATE OR REPLACE FUNCTION public.auto_recalculate_user_margins(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_used_margin DECIMAL := 0;
  total_closed_pnl DECIMAL := 0;
  base_balance DECIMAL := 10000.00;
  new_balance DECIMAL;
  trade_count INTEGER;
BEGIN
  -- Debug logging
  RAISE NOTICE 'Starting margin recalculation for user: %', _user_id;
  
  -- Calculate total margin used by open trades
  SELECT COALESCE(SUM(margin_used), 0), COUNT(*) 
  INTO total_used_margin, trade_count
  FROM trades
  WHERE user_id = _user_id AND status = 'open';
  
  RAISE NOTICE 'Open trades: count=%, total_used_margin=%', trade_count, total_used_margin;
  
  -- Calculate total P&L from ALL closed trades (this was the bug)
  SELECT COALESCE(SUM(pnl), 0), COUNT(*) 
  INTO total_closed_pnl, trade_count
  FROM trades
  WHERE user_id = _user_id AND status = 'closed';
  
  RAISE NOTICE 'Closed trades: count=%, total_pnl=%', trade_count, total_closed_pnl;
  
  -- Calculate new balance = base balance + all closed P&L
  new_balance := base_balance + total_closed_pnl;
  
  RAISE NOTICE 'Calculated balance: base=% + pnl=% = %', base_balance, total_closed_pnl, new_balance;
  
  -- Update user profile with correct values
  UPDATE user_profiles
  SET 
    balance = new_balance,
    used_margin = total_used_margin,
    available_margin = GREATEST(new_balance - total_used_margin, 0),
    equity = new_balance, -- Equity equals balance for this calculation
    updated_at = now()
  WHERE user_id = _user_id;
  
  RAISE NOTICE 'Updated user profile: balance=%, used_margin=%, available_margin=%', 
    new_balance, total_used_margin, GREATEST(new_balance - total_used_margin, 0);
END;
$function$;