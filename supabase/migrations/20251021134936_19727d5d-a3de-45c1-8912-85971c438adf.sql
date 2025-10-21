-- Fix balance calculation logic to preserve admin deposits and accumulate P&L correctly
-- This fixes the critical bug where baseBalance = 0.00 was resetting user balances

-- Drop and recreate auto_recalculate_user_margins to fix balance preservation
DROP FUNCTION IF EXISTS public.auto_recalculate_user_margins(uuid);

CREATE OR REPLACE FUNCTION public.auto_recalculate_user_margins(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_used_margin DECIMAL := 0;
  total_closed_pnl DECIMAL := 0;
  current_balance DECIMAL;
  trade_count INTEGER;
BEGIN
  RAISE NOTICE 'Starting margin recalculation for user: %', _user_id;
  
  -- Get CURRENT balance (preserves admin deposits!)
  SELECT balance INTO current_balance
  FROM user_profiles
  WHERE user_id = _user_id;
  
  IF current_balance IS NULL THEN
    current_balance := 0;
  END IF;
  
  RAISE NOTICE 'Current balance: %', current_balance;
  
  -- Calculate total margin used by open trades
  SELECT COALESCE(SUM(margin_used), 0), COUNT(*) 
  INTO total_used_margin, trade_count
  FROM trades
  WHERE user_id = _user_id AND status = 'open';
  
  RAISE NOTICE 'Open trades: count=%, total_used_margin=%', trade_count, total_used_margin;
  
  -- Update ONLY margins, preserve balance
  UPDATE user_profiles
  SET 
    used_margin = total_used_margin,
    available_margin = GREATEST(current_balance - total_used_margin, 0),
    equity = current_balance, -- Frontend adds unrealized P&L
    updated_at = now()
  WHERE user_id = _user_id;
  
  RAISE NOTICE 'Updated margins - balance preserved: %, used_margin: %, available_margin: %', 
    current_balance, total_used_margin, GREATEST(current_balance - total_used_margin, 0);
END;
$function$;

-- Fix close_trade_with_pnl to add P&L to CURRENT balance (not reset to base)
DROP FUNCTION IF EXISTS public.close_trade_with_pnl(uuid, numeric);

CREATE OR REPLACE FUNCTION public.close_trade_with_pnl(p_trade_id uuid, p_close_price numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_trade RECORD;
  v_pnl NUMERIC;
  v_price_diff NUMERIC;
  v_current_balance NUMERIC;
BEGIN
  -- Get trade details
  SELECT * INTO v_trade
  FROM trades
  WHERE id = p_trade_id
  AND status = 'open'
  FOR UPDATE; -- Lock the row

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Trade not found or already closed');
  END IF;

  -- Calculate P&L
  IF v_trade.trade_type = 'BUY' THEN
    v_price_diff := p_close_price - v_trade.open_price;
  ELSE
    v_price_diff := v_trade.open_price - p_close_price;
  END IF;

  v_pnl := v_price_diff * v_trade.amount * v_trade.leverage;

  -- Update trade
  UPDATE trades
  SET 
    status = 'closed',
    close_price = p_close_price,
    current_price = p_close_price,
    pnl = v_pnl,
    closed_at = NOW(),
    updated_at = NOW(),
    version = version + 1
  WHERE id = p_trade_id;

  -- Get CURRENT balance before updating
  SELECT balance INTO v_current_balance
  FROM user_profiles
  WHERE user_id = v_trade.user_id;

  -- Add P&L to EXISTING balance (don't reset!)
  UPDATE user_profiles
  SET 
    balance = balance + v_pnl,
    equity = balance + v_pnl,
    used_margin = GREATEST(used_margin - v_trade.margin_used, 0),
    available_margin = GREATEST((balance + v_pnl) - GREATEST(used_margin - v_trade.margin_used, 0), 0),
    updated_at = NOW()
  WHERE user_id = v_trade.user_id;

  RAISE NOTICE 'Trade closed: prev_balance=%, pnl=%, new_balance=%', v_current_balance, v_pnl, (v_current_balance + v_pnl);

  RETURN jsonb_build_object(
    'success', true,
    'pnl', v_pnl,
    'close_price', p_close_price,
    'new_balance', v_current_balance + v_pnl
  );
END;
$function$;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.auto_recalculate_user_margins(uuid) IS 
'Recalculates margins while PRESERVING current balance. Balance is only modified when trades close or admin adjusts it.';

COMMENT ON FUNCTION public.close_trade_with_pnl(uuid, numeric) IS 
'Closes trade and adds P&L to CURRENT balance, preserving admin deposits and previous P&L.';