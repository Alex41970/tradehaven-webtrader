-- Phase 1: Critical Security & Financial Protection

-- 1. Create trade execution audit log
CREATE TABLE IF NOT EXISTS trade_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  requested_price NUMERIC,
  executed_price NUMERIC,
  slippage_percent NUMERIC,
  execution_source TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  executed_by UUID,
  ip_address INET,
  user_agent TEXT,
  notes TEXT
);

-- Enable RLS on audit log
ALTER TABLE trade_execution_log ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view audit logs"
  ON trade_execution_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'::app_role
    )
  );

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
  ON trade_execution_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2. Add idempotency key to prevent duplicate trades
ALTER TABLE trades ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS trades_idempotency_key_idx ON trades(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3. Add version for optimistic locking
ALTER TABLE trades ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- 4. Trigger to prevent negative available margin
CREATE OR REPLACE FUNCTION prevent_negative_margin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.available_margin < 0 THEN
    RAISE EXCEPTION 'Insufficient margin available: % < 0', NEW.available_margin;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_margin_before_update ON user_profiles;
CREATE TRIGGER check_margin_before_update
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  WHEN (NEW.available_margin IS DISTINCT FROM OLD.available_margin)
  EXECUTE FUNCTION prevent_negative_margin();

-- 5. Add price timestamp tracking to assets
ALTER TABLE assets ADD COLUMN IF NOT EXISTS price_updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Create admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  user_id UUID,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip_address INET,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view admin audit"
  ON admin_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'::app_role
    )
  );

CREATE POLICY "Admins can insert audit entries"
  ON admin_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = admin_id);

-- 7. Remove overly broad "Authenticated users only" policies
DROP POLICY IF EXISTS "Authenticated users only" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users only" ON deposit_requests;
DROP POLICY IF EXISTS "Authenticated users only" ON withdrawal_requests;
DROP POLICY IF EXISTS "Authenticated users only" ON admin_payment_settings;
DROP POLICY IF EXISTS "Authenticated users only" ON user_payment_settings;

-- 8. Add slippage and price validation fields to trade_orders
ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS max_slippage_percent NUMERIC DEFAULT 0.5;
ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS price_at_order NUMERIC;

-- 9. Add fields to trades for better tracking
ALTER TABLE trades ADD COLUMN IF NOT EXISTS slippage_percent NUMERIC;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS price_age_ms INTEGER;

-- 10. Create index for margin monitoring performance
CREATE INDEX IF NOT EXISTS idx_trades_user_status ON trades(user_id, status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_trade_execution_log_user_action ON trade_execution_log(user_id, action, executed_at DESC);

-- 11. Function to close trade with proper P&L calculation (if not exists)
CREATE OR REPLACE FUNCTION close_trade_with_pnl(
  p_trade_id UUID,
  p_close_price NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_trade RECORD;
  v_pnl NUMERIC;
  v_price_diff NUMERIC;
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

  RETURN jsonb_build_object(
    'success', true,
    'pnl', v_pnl,
    'close_price', p_close_price
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;