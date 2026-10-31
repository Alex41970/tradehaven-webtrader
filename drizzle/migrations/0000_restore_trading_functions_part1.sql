SET check_function_bodies = false;
CREATE TYPE public.app_role AS ENUM (
    'super_admin',
    'admin',
    'user'
);
CREATE FUNCTION public.activate_bot_license(_user_id uuid, _license_key text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _license RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT * INTO _license
  FROM bot_licenses
  WHERE license_key = _license_key
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND used_by_user_id IS NULL;
  IF _license IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired license key');
  END IF;
  IF EXISTS (SELECT 1 FROM user_bot_status WHERE user_id = _user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User already has an active bot connection');
  END IF;
  UPDATE bot_licenses
  SET used_by_user_id = _user_id, updated_at = now()
  WHERE license_key = _license_key;
  INSERT INTO user_bot_status (user_id, license_key)
  VALUES (_user_id, _license_key);
  RETURN json_build_object('success', true, 'message', 'Bot license activated successfully');
END;
$$;
CREATE FUNCTION public.admin_close_trade(_admin_id uuid, _trade_id uuid, _close_price numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _trade_record RECORD;
  _close_result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT user_id, status
  INTO _trade_record
  FROM trades
  WHERE id = _trade_id;
  IF _trade_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;
  IF _trade_record.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade is already closed');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _trade_record.user_id
  ) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied to this user');
  END IF;
  SELECT close_trade_with_pnl(_trade_id, _close_price) INTO _close_result;
  IF (_close_result->>'error') IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', _close_result->>'error');
  END IF;
  PERFORM auto_recalculate_user_margins(_trade_record.user_id);
  RETURN jsonb_build_object(
    'success', true,
    'pnl', (_close_result->>'pnl')::numeric,
    'new_balance', (_close_result->>'new_balance')::numeric,
    'close_price', (_close_result->>'close_price')::numeric,
    'message', 'Trade closed successfully by admin'
  );
END;
$$;
CREATE FUNCTION public.admin_create_trade(_admin_id uuid, _user_id uuid, _asset_id uuid, _symbol text, _trade_type text, _amount numeric, _leverage integer, _open_price numeric) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user_profile RECORD;
  _asset_record RECORD;
  _margin_required NUMERIC;
  _trade_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _user_id
  ) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied to this user');
  END IF;
  SELECT balance, used_margin, available_margin
  INTO _user_profile
  FROM user_profiles
  WHERE user_id = _user_id;
  IF _user_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  SELECT min_trade_size, max_leverage, is_active
  INTO _asset_record
  FROM assets
  WHERE id = _asset_id;
  IF _asset_record IS NULL OR NOT _asset_record.is_active THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or inactive asset');
  END IF;
  IF _amount < _asset_record.min_trade_size THEN
    RETURN json_build_object('success', false, 'error', 'Amount below minimum trade size');
  END IF;
  IF _leverage > _asset_record.max_leverage THEN
    RETURN json_build_object('success', false, 'error', 'Leverage exceeds maximum allowed');
  END IF;
  IF _trade_type NOT IN ('BUY', 'SELL') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid trade type');
  END IF;
  _margin_required = _amount * _open_price / _leverage;
  IF _user_profile.available_margin < _margin_required THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient margin available');
  END IF;
  INSERT INTO trades (
    user_id,
    asset_id,
    symbol,
    trade_type,
    amount,
    leverage,
    open_price,
    current_price,
    margin_used,
    status,
    trade_source
  ) VALUES (
    _user_id,
    _asset_id,
    _symbol,
    _trade_type,
    _amount,
    _leverage,
    _open_price,
    _open_price,
    _margin_required,
    'open',
    'bot'
  ) RETURNING id INTO _trade_id;
  RETURN json_build_object(
    'success', true,
    'trade_id', _trade_id,
    'margin_used', _margin_required,
    'message', 'Bot trade created successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
CREATE FUNCTION public.admin_delete_trade(_admin_id uuid, _trade_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _trade RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT * INTO _trade FROM trades WHERE id = _trade_id;
  IF _trade IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _trade.user_id
  ) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  IF _trade.status = 'open' THEN
    UPDATE user_profiles
    SET
      used_margin = GREATEST(used_margin - _trade.margin_used, 0),
      available_margin = available_margin + _trade.margin_used,
      updated_at = NOW()
    WHERE user_id = _trade.user_id;
  END IF;
  IF _trade.status = 'closed' AND _trade.pnl IS NOT NULL THEN
    UPDATE user_profiles
    SET
      balance = balance - _trade.pnl,
      equity = equity - _trade.pnl,
      available_margin = GREATEST(available_margin - _trade.pnl, 0),
      updated_at = NOW()
    WHERE user_id = _trade.user_id;
  END IF;
  DELETE FROM trades WHERE id = _trade_id;
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
CREATE FUNCTION public.admin_modify_trade_open_price(_admin_id uuid, _trade_id uuid, _new_open_price numeric) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _trade_user_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT user_id INTO _trade_user_id
  FROM trades
  WHERE id = _trade_id;
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _trade_user_id
  ) AND NOT has_role(_admin_id, 'super_admin') THEN
    RETURN false;
  END IF;
  UPDATE trades
  SET open_price = _new_open_price
  WHERE id = _trade_id;
  RETURN true;
END;
$$;
CREATE FUNCTION public.admin_modify_user_balance(_admin_id uuid, _user_id uuid, _amount numeric, _operation text, _reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _current_balance NUMERIC;
  _new_balance NUMERIC;
  _delta NUMERIC;
  _deposit_id uuid;
  _withdrawal_id uuid;
  _rowcount INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _user_id
  ) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  SELECT balance INTO _current_balance
  FROM user_profiles
  WHERE user_id = _user_id;
  IF _current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;
  IF _operation = 'set' THEN
    _delta := _amount - _current_balance;
    UPDATE user_profiles
    SET balance = _amount,
        equity = _amount,
        available_margin = GREATEST(_amount - used_margin, 0),
        updated_at = now()
    WHERE user_id = _user_id;
    GET DIAGNOSTICS _rowcount = ROW_COUNT;
    IF _rowcount = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profile update failed');
    END IF;
    _new_balance := _amount;
    IF _delta > 0 THEN
      INSERT INTO deposit_requests (
        user_id, amount, status, deposit_type, processed_by_admin, processed_at, admin_notes
      ) VALUES (
        _user_id, ABS(_delta), 'approved', 'admin_adjustment', _admin_id, now(),
        COALESCE(_reason, format('Balance set from %s to %s by admin', _current_balance, _amount))
      ) RETURNING id INTO _deposit_id;
    ELSIF _delta < 0 THEN
      INSERT INTO withdrawal_requests (
        user_id, amount, status, withdrawal_type, processed_by_admin, processed_at, admin_notes
      ) VALUES (
        _user_id, ABS(_delta), 'approved', 'admin_adjustment', _admin_id, now(),
        COALESCE(_reason, format('Balance set from %s to %s by admin', _current_balance, _amount))
      ) RETURNING id INTO _withdrawal_id;
    END IF;
  ELSIF _operation = 'add' THEN
    UPDATE user_profiles
    SET balance = balance + _amount,
        equity = equity + _amount,
        available_margin = available_margin + _amount,
        updated_at = now()
    WHERE user_id = _user_id;
    GET DIAGNOSTICS _rowcount = ROW_COUNT;
    IF _rowcount = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profile update failed');
    END IF;
    _new_balance := _current_balance + _amount;
    INSERT INTO deposit_requests (
      user_id, amount, status, deposit_type, processed_by_admin, processed_at, admin_notes
    ) VALUES (
      _user_id, _amount, 'approved', 'admin_adjustment', _admin_id, now(),
      COALESCE(_reason, 'Balance added by admin')
    ) RETURNING id INTO _deposit_id;
  ELSIF _operation = 'deduct' THEN
    UPDATE user_profiles
    SET balance = GREATEST(balance - _amount, 0),
        equity = GREATEST(equity - _amount, 0),
        available_margin = GREATEST(available_margin - _amount, 0),
        updated_at = now()
    WHERE user_id = _user_id;
    GET DIAGNOSTICS _rowcount = ROW_COUNT;
    IF _rowcount = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profile update failed');
    END IF;
    _new_balance := GREATEST(_current_balance - _amount, 0);
    INSERT INTO withdrawal_requests (
      user_id, amount, status, withdrawal_type, processed_by_admin, processed_at, admin_notes
    ) VALUES (
      _user_id, _amount, 'approved', 'admin_adjustment', _admin_id, now(),
      COALESCE(_reason, 'Balance deducted by admin')
    ) RETURNING id INTO _withdrawal_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid operation');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Balance %s successfully', _operation),
    'previous_balance', _current_balance,
    'new_balance', _new_balance,
    'created_deposit_id', _deposit_id,
    'created_withdrawal_id', _withdrawal_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
CREATE FUNCTION public.admin_reset_account(_admin_id uuid, _user_id uuid, _close_trades boolean DEFAULT true, _clear_history boolean DEFAULT false, _reset_balance boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _trades_closed INTEGER := 0;
  _trades_deleted INTEGER := 0;
  _previous_balance NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _user_id
  ) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  SELECT balance INTO _previous_balance FROM user_profiles WHERE user_id = _user_id;
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
  IF _clear_history THEN
    DELETE FROM trades WHERE user_id = _user_id;
    GET DIAGNOSTICS _trades_deleted = ROW_COUNT;
  END IF;
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
CREATE FUNCTION public.assign_user_to_admin_via_promo(_user_id uuid, _promo_code text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _admin_id UUID;
  _code_data RECORD;
  _user_exists BOOLEAN;
  _update_count INTEGER;
  _current_admin_id UUID;
BEGIN
  SELECT admin_id, is_active, expires_at, max_uses, current_uses
  INTO _code_data
  FROM promo_codes
  WHERE code = _promo_code;
  IF _code_data IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid promo code');
  END IF;
  IF NOT _code_data.is_active THEN
    RETURN json_build_object('success', false, 'error', 'Promo code is inactive');
  END IF;
  IF _code_data.expires_at IS NOT NULL AND _code_data.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Promo code has expired');
  END IF;
  IF _code_data.max_uses IS NOT NULL AND _code_data.current_uses >= _code_data.max_uses THEN
    RETURN json_build_object('success', false, 'error', 'Promo code usage limit reached');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _code_data.admin_id AND role = 'admin'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Associated admin no longer exists');
  END IF;
  SELECT admin_id INTO _current_admin_id
  FROM user_profiles
  WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  IF _current_admin_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'User is already assigned to an admin');
  END IF;
  BEGIN
    UPDATE user_profiles
    SET
      admin_id = _code_data.admin_id,
      promo_code_used = _promo_code,
      assignment_method = 'promo_code',
      assigned_at = now()
    WHERE user_id = _user_id
      AND admin_id IS NULL;
    GET DIAGNOSTICS _update_count = ROW_COUNT;
    IF _update_count = 0 THEN
      RAISE EXCEPTION 'Failed to update user profile - no rows affected or user already assigned';
    END IF;
    SELECT admin_id INTO _current_admin_id
    FROM user_profiles
    WHERE user_id = _user_id;
    IF _current_admin_id != _code_data.admin_id THEN
      RAISE EXCEPTION 'Update verification failed - admin_id not set correctly. Expected: %, Got: %', _code_data.admin_id, _current_admin_id;
    END IF;
    INSERT INTO admin_user_relationships (admin_id, user_id)
    VALUES (_code_data.admin_id, _user_id)
    ON CONFLICT (user_id) DO UPDATE SET admin_id = _code_data.admin_id;
    BEGIN
      UPDATE promo_codes
      SET current_uses = current_uses + 1
      WHERE code = _promo_code;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to increment promo usage: %', SQLERRM;
    END;
    RETURN json_build_object(
      'success', true,
      'admin_id', _code_data.admin_id,
      'message', 'User successfully assigned to admin via promo code'
    );
  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Assignment failed: ' || SQLERRM
      );
  END;
END;
$$;
CREATE FUNCTION public.auto_fix_detected_issues() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  fix_report JSON;
  users_fixed INTEGER := 0;
  total_fixes INTEGER := 0;
  user_record RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  FOR user_record IN SELECT DISTINCT user_id FROM user_profiles LOOP
    PERFORM public.auto_recalculate_user_margins(user_record.user_id);
    users_fixed := users_fixed + 1;
  END LOOP;
  total_fixes := users_fixed;
  DELETE FROM trades
  WHERE user_id NOT IN (SELECT user_id FROM user_profiles);
  DELETE FROM trade_orders
  WHERE asset_id NOT IN (SELECT id FROM assets);
  fix_report := json_build_object(
    'timestamp', now(),
    'status', 'completed',
    'fixes_applied', json_build_object(
      'users_recalculated', users_fixed,
      'total_fixes', total_fixes
    ),
    'message', 'Automatic fixes completed successfully'
  );
  RETURN fix_report;
END;
$$;
CREATE FUNCTION public.auto_recalculate_user_margins(_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  total_used_margin DECIMAL := 0;
  current_balance DECIMAL;
  liquidation_result json;
  trade_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT balance INTO current_balance
  FROM user_profiles
  WHERE user_id = _user_id;
  IF current_balance IS NULL THEN
    current_balance := 0;
  END IF;
  SELECT COALESCE(SUM(margin_used), 0), COUNT(*)
  INTO total_used_margin, trade_count
  FROM trades
  WHERE user_id = _user_id AND status = 'open';
  UPDATE user_profiles
  SET
    used_margin = total_used_margin,
    available_margin = GREATEST(current_balance - total_used_margin, 0),
    equity = current_balance,
    updated_at = now()
  WHERE user_id = _user_id;
  SELECT check_and_liquidate_positions(_user_id) INTO liquidation_result;
END;
$$;
CREATE FUNCTION public.calculate_pnl(trade_type text, amount numeric, open_price numeric, current_price numeric) RETURNS numeric
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF trade_type = 'BUY' THEN
    RETURN amount * (current_price - open_price);
  ELSE
    RETURN amount * (open_price - current_price);
  END IF;
END;
$$;
CREATE FUNCTION public.calculate_pnl(trade_type text, amount numeric, open_price numeric, current_price numeric, leverage_param numeric DEFAULT 1) RETURNS numeric
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF leverage_param IS NULL OR leverage_param <= 0 THEN
    leverage_param := 1;
  END IF;
  IF trade_type = 'BUY' THEN
    RETURN amount * (current_price - open_price) * leverage_param;
  ELSE
    RETURN amount * (open_price - current_price) * leverage_param;
  END IF;
END;
$$;
CREATE FUNCTION public.check_and_liquidate_positions(_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_equity NUMERIC;
  user_used_margin NUMERIC;
  margin_level NUMERIC;
  trades_closed INTEGER := 0;
  open_trade RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT balance, used_margin INTO user_equity, user_used_margin
  FROM user_profiles
  WHERE user_id = _user_id;
  IF user_used_margin > 0 THEN
    margin_level := (user_equity / user_used_margin) * 100;
  ELSE
    margin_level := 999;
  END IF;
  IF margin_level <= 50 AND margin_level > 0 THEN
    FOR open_trade IN
      SELECT t.id, t.symbol, a.price as current_price
      FROM trades t
      JOIN assets a ON t.asset_id = a.id
      WHERE t.user_id = _user_id AND t.status = 'open'
    LOOP
      PERFORM close_trade_with_pnl(open_trade.id, open_trade.current_price);
      trades_closed := trades_closed + 1;
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
CREATE FUNCTION public.close_trade_with_pnl(p_trade_id uuid, p_close_price numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_trade RECORD;
  v_pnl NUMERIC;
  v_price_diff NUMERIC;
  v_current_balance NUMERIC;
BEGIN
  SELECT * INTO v_trade
  FROM trades
  WHERE id = p_trade_id
  AND status = 'open'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Trade not found or already closed');
  END IF;
  IF auth.uid() IS NOT NULL AND v_trade.user_id IS DISTINCT FROM auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;
  IF v_trade.trade_type = 'BUY' THEN
    v_price_diff := p_close_price - v_trade.open_price;
  ELSE
    v_price_diff := v_trade.open_price - p_close_price;
  END IF;
  v_pnl := v_price_diff * v_trade.amount * v_trade.leverage;
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
  SELECT balance INTO v_current_balance
  FROM user_profiles
  WHERE user_id = v_trade.user_id;
  UPDATE user_profiles
  SET
    balance = balance + v_pnl,
    equity = balance + v_pnl,
    used_margin = GREATEST(used_margin - v_trade.margin_used, 0),
    available_margin = GREATEST((balance + v_pnl) - GREATEST(used_margin - v_trade.margin_used, 0), 0),
    updated_at = NOW()
  WHERE user_id = v_trade.user_id;
  RETURN jsonb_build_object(
    'success', true,
    'pnl', v_pnl,
    'close_price', p_close_price,
    'new_balance', v_current_balance + v_pnl
  );
END;
$$;
CREATE FUNCTION public.deactivate_and_disconnect_license(_admin_id uuid, _license_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _license RECORD;
  _affected_users TEXT[] := ARRAY[]::TEXT[];
  _user_email TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT * INTO _license
  FROM bot_licenses
  WHERE id = _license_id AND admin_id = _admin_id;
  IF _license IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'License not found or access denied');
  END IF;
  IF _license.used_by_user_id IS NOT NULL THEN
    SELECT email INTO _user_email
    FROM user_profiles
    WHERE user_id = _license.used_by_user_id;
    IF _user_email IS NOT NULL THEN
      _affected_users := array_append(_affected_users, _user_email);
    END IF;
    DELETE FROM user_bot_status
    WHERE user_id = _license.used_by_user_id AND license_key = _license.license_key;
    UPDATE bot_licenses
    SET used_by_user_id = NULL, updated_at = now()
    WHERE id = _license_id;
  END IF;
  UPDATE bot_licenses
  SET is_active = false, updated_at = now()
  WHERE id = _license_id;
  RETURN json_build_object(
    'success', true,
    'affected_users', _affected_users,
    'message', CASE
      WHEN array_length(_affected_users, 1) > 0
      THEN format('License deactivated and %s user(s) disconnected', array_length(_affected_users, 1))
      ELSE 'License deactivated'
    END
  );
END;
$$;
CREATE FUNCTION public.generate_bot_license(_admin_id uuid, _expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _license_key TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF NOT has_role(_admin_id, 'admin'::app_role) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can generate license keys';
  END IF;
  _license_key := 'TBL-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)) || '-' ||
                  upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)) || '-' ||
                  upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  INSERT INTO bot_licenses (license_key, admin_id, expires_at)
  VALUES (_license_key, _admin_id, _expires_at);
  RETURN _license_key;
END;
$$;