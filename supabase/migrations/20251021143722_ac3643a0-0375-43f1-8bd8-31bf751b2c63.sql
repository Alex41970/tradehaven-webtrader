-- ============================================
-- PHASE 1: CRITICAL - Auto-Liquidation System
-- ============================================

-- Create auto-liquidation function
CREATE OR REPLACE FUNCTION public.check_and_liquidate_positions(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_equity NUMERIC;
  user_used_margin NUMERIC;
  margin_level NUMERIC;
  trades_closed INTEGER := 0;
  open_trade RECORD;
BEGIN
  -- Get user's current equity and used margin
  SELECT balance, used_margin INTO user_equity, user_used_margin
  FROM user_profiles
  WHERE user_id = _user_id;
  
  -- Calculate margin level
  IF user_used_margin > 0 THEN
    margin_level := (user_equity / user_used_margin) * 100;
  ELSE
    margin_level := 999; -- No open positions
  END IF;
  
  -- If margin level is critical (≤50%), force close all positions
  IF margin_level <= 50 AND margin_level > 0 THEN
    RAISE NOTICE 'STOP-OUT TRIGGERED for user % - Margin Level: %', _user_id, margin_level;
    
    -- Close all open trades
    FOR open_trade IN 
      SELECT t.id, t.symbol, a.price as current_price
      FROM trades t
      JOIN assets a ON t.asset_id = a.id
      WHERE t.user_id = _user_id AND t.status = 'open'
    LOOP
      -- Use existing close_trade_with_pnl function
      PERFORM close_trade_with_pnl(open_trade.id, open_trade.current_price);
      trades_closed := trades_closed + 1;
      
      RAISE NOTICE 'Force closed trade % (%) due to stop-out', open_trade.id, open_trade.symbol;
    END LOOP;
    
    RETURN json_build_object(
      'stop_out_triggered', true,
      'margin_level', margin_level,
      'trades_closed', trades_closed
    );
  END IF;
  
  RETURN json_build_object(
    'stop_out_triggered', false,
    'margin_level', margin_level
  );
END;
$$;

-- Update auto_recalculate_user_margins to include liquidation check
CREATE OR REPLACE FUNCTION public.auto_recalculate_user_margins(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_used_margin DECIMAL := 0;
  current_balance DECIMAL;
  liquidation_result json;
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
  
  -- After updating margins, check if liquidation is needed
  SELECT check_and_liquidate_positions(_user_id) INTO liquidation_result;
  
  IF (liquidation_result->>'stop_out_triggered')::boolean THEN
    RAISE NOTICE 'Stop-out executed: %', liquidation_result;
  END IF;
END;
$function$;

-- ============================================
-- PHASE 1: Update Balance Reset Function
-- ============================================

-- Modify admin_modify_user_balance to support 'set' operation
CREATE OR REPLACE FUNCTION public.admin_modify_user_balance(
  _admin_id uuid, 
  _user_id uuid, 
  _amount numeric, 
  _operation text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify admin has access to this user
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _user_id
  ) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN false;
  END IF;
  
  IF _operation = 'set' THEN
    -- NEW: Directly set balance (for fixing negative balances)
    UPDATE user_profiles
    SET balance = _amount,
        equity = _amount,
        available_margin = GREATEST(_amount - used_margin, 0),
        updated_at = now()
    WHERE user_id = _user_id;
  ELSIF _operation = 'add' THEN
    UPDATE user_profiles
    SET balance = balance + _amount,
        equity = equity + _amount,
        available_margin = available_margin + _amount
    WHERE user_id = _user_id;
  ELSIF _operation = 'deduct' THEN
    UPDATE user_profiles
    SET balance = GREATEST(balance - _amount, 0),
        equity = GREATEST(equity - _amount, 0),
        available_margin = GREATEST(available_margin - _amount, 0)
    WHERE user_id = _user_id;
  END IF;
  
  RETURN true;
END;
$function$;

-- ============================================
-- PHASE 2: Order Monitor Cron Job
-- ============================================

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule order monitor to run every 30 seconds
SELECT cron.schedule(
  'order-monitor-job',
  '*/30 * * * * *', -- Every 30 seconds
  $$
  SELECT
    net.http_post(
        url:='https://stdfkfutgkmnaajixguz.supabase.co/functions/v1/order-monitor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZGZrZnV0Z2ttbmFhaml4Z3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTI3NjUsImV4cCI6MjA3MTg4ODc2NX0.kf5keye0-ezD9cjcvTWxMsBbpVELf_cWIwL2OeW0Yg4"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- ============================================
-- PHASE 3: Database Index Optimization
-- ============================================

-- Create composite index for common trade queries
CREATE INDEX IF NOT EXISTS idx_trades_user_status_opened 
ON trades(user_id, status, opened_at DESC);