-- Add margin/risk settings to admin_trading_settings
ALTER TABLE admin_trading_settings 
  ADD COLUMN IF NOT EXISTS margin_call_level INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS stop_out_level INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS allow_negative_balance BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS grace_period_hours INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS auto_close_enabled BOOLEAN DEFAULT true;

-- Add account status columns to user_profiles
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS grace_period_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS frozen_reason TEXT;

-- Create admin_reset_account RPC function
CREATE OR REPLACE FUNCTION public.admin_reset_account(
  _admin_id UUID,
  _user_id UUID,
  _close_trades BOOLEAN DEFAULT true,
  _clear_history BOOLEAN DEFAULT false,
  _reset_balance BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _trades_closed INTEGER := 0;
  _trades_deleted INTEGER := 0;
  _previous_balance NUMERIC;
BEGIN
  -- Verify admin has access
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _user_id
  ) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Get previous balance for audit
  SELECT balance INTO _previous_balance FROM user_profiles WHERE user_id = _user_id;

  -- Close all open trades (release margin without P&L)
  IF _close_trades THEN
    UPDATE trades 
    SET 
      status = 'closed',
      close_price = open_price,
      pnl = 0,
      closed_at = NOW(),
      updated_at = NOW()
    WHERE user_id = _user_id AND status = 'open';
    
    GET DIAGNOSTICS _trades_closed = ROW_COUNT;
  END IF;

  -- Clear trade history if requested
  IF _clear_history THEN
    DELETE FROM trades WHERE user_id = _user_id;
    GET DIAGNOSTICS _trades_deleted = ROW_COUNT;
  END IF;

  -- Reset balance if requested
  IF _reset_balance THEN
    UPDATE user_profiles
    SET 
      balance = 0,
      equity = 0,
      used_margin = 0,
      available_margin = 0,
      account_status = 'active',
      grace_period_until = NULL,
      frozen_at = NULL,
      frozen_reason = NULL,
      updated_at = NOW()
    WHERE user_id = _user_id;
  END IF;

  -- Log the reset action
  INSERT INTO admin_audit_log (admin_id, user_id, action, old_value, new_value, action_details)
  VALUES (
    _admin_id,
    _user_id,
    'account_reset',
    jsonb_build_object('balance', _previous_balance),
    jsonb_build_object('balance', 0),
    jsonb_build_object(
      'close_trades', _close_trades,
      'clear_history', _clear_history,
      'reset_balance', _reset_balance,
      'trades_closed', _trades_closed,
      'trades_deleted', _trades_deleted
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'trades_closed', _trades_closed,
    'trades_deleted', _trades_deleted,
    'previous_balance', _previous_balance
  );
END;
$$;

-- Create admin_delete_trade RPC function
CREATE OR REPLACE FUNCTION public.admin_delete_trade(
  _admin_id UUID,
  _trade_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _trade RECORD;
BEGIN
  -- Get trade details
  SELECT * INTO _trade FROM trades WHERE id = _trade_id;

  IF _trade IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- Verify admin has access
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _trade.user_id
  ) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- If trade was open, we need to release the margin
  IF _trade.status = 'open' THEN
    UPDATE user_profiles
    SET 
      used_margin = GREATEST(used_margin - _trade.margin_used, 0),
      available_margin = available_margin + _trade.margin_used,
      updated_at = NOW()
    WHERE user_id = _trade.user_id;
  END IF;

  -- If trade was closed, reverse the P&L impact
  IF _trade.status = 'closed' AND _trade.pnl IS NOT NULL THEN
    UPDATE user_profiles
    SET 
      balance = balance - _trade.pnl,
      equity = equity - _trade.pnl,
      available_margin = GREATEST(available_margin - _trade.pnl, 0),
      updated_at = NOW()
    WHERE user_id = _trade.user_id;
  END IF;

  -- Delete the trade
  DELETE FROM trades WHERE id = _trade_id;

  -- Log the deletion
  INSERT INTO admin_audit_log (admin_id, user_id, action, old_value, action_details)
  VALUES (
    _admin_id,
    _trade.user_id,
    'trade_deleted',
    row_to_json(_trade)::jsonb,
    jsonb_build_object('trade_id', _trade_id, 'was_open', _trade.status = 'open')
  );

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', _trade_id,
    'was_open', _trade.status = 'open',
    'margin_released', CASE WHEN _trade.status = 'open' THEN _trade.margin_used ELSE 0 END,
    'pnl_reversed', CASE WHEN _trade.status = 'closed' THEN _trade.pnl ELSE 0 END
  );
END;
$$;

-- Add DELETE policy for trades table for admins
CREATE POLICY "Admins can delete assigned users trades"
ON public.trades
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_user_relationships.admin_id = auth.uid() 
    AND admin_user_relationships.user_id = trades.user_id
  )
);