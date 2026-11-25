-- =====================================================================
-- Edge Wealth Pro - complete database setup (single run, safe to re-run)
-- Paste everything into Supabase > SQL Editor > New query > Run.
-- It wipes any half-finished earlier attempt, then builds everything fresh.
-- =====================================================================
BEGIN;

-- 1) Stop any old scheduled jobs from earlier attempts
DO $reset$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job;
  END IF;
END
$reset$;

-- 2) Remove leftovers from earlier attempts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, service_role;
SET search_path TO public, extensions;

-- ---------- 0000_restore_trading_functions_part1.sql ----------
SET search_path TO public, extensions;
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
;

-- ---------- 0001_restore_trading_functions_part2.sql ----------
SET search_path TO public, extensions;
SET check_function_bodies = false;
CREATE FUNCTION public.get_promo_code_stats() RETURNS TABLE(id uuid, code text, admin_id uuid, admin_email text, is_active boolean, max_uses integer, current_uses integer, expires_at timestamp with time zone, created_at timestamp with time zone, assigned_users_count bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    pc.id,
    pc.code,
    pc.admin_id,
    up.email as admin_email,
    pc.is_active,
    pc.max_uses,
    pc.current_uses,
    pc.expires_at,
    pc.created_at,
    COUNT(up_users.user_id) as assigned_users_count
  FROM promo_codes pc
  LEFT JOIN user_profiles up ON up.user_id = pc.admin_id
  LEFT JOIN user_profiles up_users ON up_users.promo_code_used = pc.code
  WHERE auth.uid() IS NULL OR pc.admin_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role)
  GROUP BY pc.id, pc.code, pc.admin_id, up.email, pc.is_active, pc.max_uses, pc.current_uses, pc.expires_at, pc.created_at
  ORDER BY pc.created_at DESC;
$$;
CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role
  FROM user_roles
  WHERE user_id = _user_id
  ORDER BY
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'user' THEN 3
    END
  LIMIT 1
$$;
CREATE FUNCTION public.get_valid_bot_status(_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _bot_status RECORD;
  _license RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT * INTO _bot_status
  FROM user_bot_status
  WHERE user_id = _user_id;
  IF _bot_status IS NULL THEN
    RETURN json_build_object('valid', false, 'reason', 'no_bot_status');
  END IF;
  SELECT * INTO _license
  FROM bot_licenses
  WHERE license_key = _bot_status.license_key
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > now());
  IF _license IS NULL THEN
    DELETE FROM user_bot_status WHERE user_id = _user_id;
    UPDATE bot_licenses
    SET used_by_user_id = NULL
    WHERE license_key = _bot_status.license_key AND used_by_user_id = _user_id;
    RETURN json_build_object('valid', false, 'reason', 'invalid_license');
  END IF;
  RETURN json_build_object(
    'valid', true,
    'bot_status', row_to_json(_bot_status),
    'license', row_to_json(_license)
  );
END;
$$;
CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_promo_code TEXT;
  v_code_data RECORD;
BEGIN
  INSERT INTO user_profiles (
    user_id,
    email,
    first_name,
    surname,
    phone_number,
    balance,
    equity,
    available_margin
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'surname',
    NEW.raw_user_meta_data ->> 'phone_number',
    0.00,
    0.00,
    0.00
  );
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  v_promo_code := NEW.raw_user_meta_data->>'promo_code';
  IF v_promo_code IS NOT NULL AND trim(v_promo_code) != '' THEN
    BEGIN
      SELECT * INTO v_code_data
      FROM promo_codes
      WHERE code = trim(v_promo_code);
      IF v_code_data IS NOT NULL
         AND v_code_data.is_active
         AND (v_code_data.expires_at IS NULL OR v_code_data.expires_at > now())
         AND (v_code_data.max_uses IS NULL OR v_code_data.current_uses < v_code_data.max_uses)
         AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_code_data.admin_id AND role = 'admin')
      THEN
        UPDATE user_profiles
        SET
          admin_id = v_code_data.admin_id,
          promo_code_used = trim(v_promo_code),
          assignment_method = 'promo_code',
          assigned_at = now()
        WHERE user_id = NEW.id;
        INSERT INTO admin_user_relationships (admin_id, user_id)
        VALUES (v_code_data.admin_id, NEW.id);
        BEGIN
          UPDATE promo_codes
          SET current_uses = current_uses + 1
          WHERE code = trim(v_promo_code);
          UPDATE promo_validation_attempts
          SET resulted_in_signup = true,
              created_user_id = NEW.id
          WHERE id = (
            SELECT id FROM promo_validation_attempts
            WHERE promo_code = trim(v_promo_code)
              AND created_user_id IS NULL
            ORDER BY attempted_at DESC
            LIMIT 1
          );
        EXCEPTION
          WHEN OTHERS THEN
            RAISE WARNING 'Failed to update promo usage/validation: %', SQLERRM;
        END;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Promo code assignment failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$_$;
CREATE FUNCTION public.handle_new_user_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.handle_trade_closed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    PERFORM public.auto_recalculate_user_margins(NEW.user_id);
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TRIGGER ERROR in handle_trade_closed: %', SQLERRM;
    RETURN NEW;
END;
$$;
CREATE FUNCTION public.handle_trade_opened() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'open' THEN
    PERFORM public.auto_recalculate_user_margins(NEW.user_id);
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TRIGGER ERROR in handle_trade_opened: %', SQLERRM;
    RETURN NEW;
END;
$$;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
CREATE FUNCTION public.notify_profile_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM pg_notify('profile_updated', json_build_object(
    'user_id', NEW.user_id,
    'balance', NEW.balance,
    'used_margin', NEW.used_margin,
    'available_margin', NEW.available_margin,
    'equity', NEW.equity,
    'updated_at', NEW.updated_at
  )::text);
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.prevent_negative_margin() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.available_margin < 0 THEN
    RAISE EXCEPTION 'Insufficient margin available: % < 0', NEW.available_margin;
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.prevent_user_financial_updates() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.admin_id IS NULL AND NEW.admin_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF auth.uid() = NEW.user_id AND NOT (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    NEW.balance = OLD.balance;
    NEW.equity = OLD.equity;
    NEW.used_margin = OLD.used_margin;
    NEW.available_margin = OLD.available_margin;
    NEW.admin_id = OLD.admin_id;
    NEW.promo_code_used = OLD.promo_code_used;
    NEW.assignment_method = OLD.assignment_method;
    NEW.assigned_at = OLD.assigned_at;
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.process_deposit_request(_admin_id uuid, _request_id uuid, _action text, _admin_notes text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _request RECORD;
  _user_admin_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT * INTO _request FROM deposit_requests WHERE id = _request_id;
  IF _request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;
  SELECT admin_id INTO _user_admin_id FROM user_profiles WHERE user_id = _request.user_id;
  IF NOT (has_role(_admin_id, 'super_admin'::app_role) OR _user_admin_id = _admin_id) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  UPDATE deposit_requests
  SET
    status = _action,
    admin_notes = _admin_notes,
    processed_at = now(),
    processed_by_admin = _admin_id
  WHERE id = _request_id;
  IF _action = 'approved' THEN
    UPDATE user_profiles
    SET
      balance = balance + _request.amount,
      equity = equity + _request.amount,
      available_margin = available_margin + _request.amount
    WHERE user_id = _request.user_id;
  END IF;
  RETURN json_build_object('success', true, 'message', 'Request processed successfully');
END;
$$;
CREATE FUNCTION public.process_withdrawal_request(_admin_id uuid, _request_id uuid, _action text, _admin_notes text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _request RECORD;
  _user_admin_id UUID;
  _user_balance NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT * INTO _request FROM withdrawal_requests WHERE id = _request_id;
  IF _request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;
  SELECT admin_id, balance INTO _user_admin_id, _user_balance FROM user_profiles WHERE user_id = _request.user_id;
  IF NOT (has_role(_admin_id, 'super_admin'::app_role) OR _user_admin_id = _admin_id) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  IF _action = 'approved' AND _user_balance < _request.amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  UPDATE withdrawal_requests
  SET
    status = _action,
    admin_notes = _admin_notes,
    processed_at = now(),
    processed_by_admin = _admin_id
  WHERE id = _request_id;
  IF _action = 'approved' THEN
    UPDATE user_profiles
    SET
      balance = balance - _request.amount,
      equity = equity - _request.amount,
      available_margin = GREATEST(available_margin - _request.amount, 0)
    WHERE user_id = _request.user_id;
  END IF;
  RETURN json_build_object('success', true, 'message', 'Request processed successfully');
END;
$$;
CREATE FUNCTION public.recalculate_user_margins(_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  total_used_margin DECIMAL := 0;
  total_closed_pnl DECIMAL := 0;
  base_balance DECIMAL := 0.00;
  new_balance DECIMAL;
  current_profile RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT * INTO current_profile FROM user_profiles WHERE user_id = _user_id;
  IF current_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  SELECT COALESCE(SUM(margin_used), 0) INTO total_used_margin
  FROM trades
  WHERE user_id = _user_id AND status = 'open';
  SELECT COALESCE(SUM(pnl), 0) INTO total_closed_pnl
  FROM trades
  WHERE user_id = _user_id AND status = 'closed';
  new_balance := base_balance + total_closed_pnl;
  UPDATE user_profiles
  SET
    balance = new_balance,
    used_margin = total_used_margin,
    available_margin = GREATEST(new_balance - total_used_margin, 0),
    updated_at = now()
  WHERE user_id = _user_id;
  RETURN json_build_object(
    'success', true,
    'balance', new_balance,
    'used_margin', total_used_margin,
    'available_margin', GREATEST(new_balance - total_used_margin, 0)
  );
END;
$$;
CREATE FUNCTION public.release_coordinator_lock(p_instance_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM coordinator_lock
  WHERE id = 'price-relay' AND instance_id = p_instance_id;
  RETURN FOUND;
END;
$$;
CREATE FUNCTION public.renew_coordinator_lock(p_instance_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE coordinator_lock
  SET
    expires_at = now() + interval '45 seconds',
    heartbeat_at = now()
  WHERE id = 'price-relay' AND instance_id = p_instance_id;
  RETURN FOUND;
END;
$$;
CREATE FUNCTION public.run_system_health_check() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  health_report JSON;
  user_count INTEGER;
  total_issues INTEGER := 0;
  margin_issues INTEGER := 0;
  balance_issues INTEGER := 0;
  orphaned_trades INTEGER := 0;
  invalid_orders INTEGER := 0;
  issues_array JSON[] := ARRAY[]::JSON[];
  user_record RECORD;
  trade_record RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT COUNT(*) INTO user_count FROM user_profiles;
  FOR user_record IN
    SELECT
      up.user_id,
      up.balance,
      up.used_margin,
      up.available_margin,
      COALESCE(SUM(t.margin_used), 0) as calculated_used_margin,
      COALESCE(SUM(CASE WHEN t.status = 'closed' THEN t.pnl ELSE 0 END), 0) as total_closed_pnl
    FROM user_profiles up
    LEFT JOIN trades t ON up.user_id = t.user_id AND t.status = 'open'
    GROUP BY up.user_id, up.balance, up.used_margin, up.available_margin
  LOOP
    IF user_record.used_margin != user_record.calculated_used_margin THEN
      margin_issues := margin_issues + 1;
      total_issues := total_issues + 1;
      issues_array := array_append(issues_array, json_build_object(
        'type', 'margin_inconsistency',
        'user_id', user_record.user_id,
        'stored_margin', user_record.used_margin,
        'calculated_margin', user_record.calculated_used_margin,
        'severity', 'high'
      ));
    END IF;
    IF user_record.balance != (10000.00 + user_record.total_closed_pnl) THEN
      balance_issues := balance_issues + 1;
      total_issues := total_issues + 1;
      issues_array := array_append(issues_array, json_build_object(
        'type', 'balance_inconsistency',
        'user_id', user_record.user_id,
        'stored_balance', user_record.balance,
        'calculated_balance', (10000.00 + user_record.total_closed_pnl),
        'severity', 'high'
      ));
    END IF;
    IF user_record.available_margin != GREATEST(user_record.balance - user_record.used_margin, 0) THEN
      total_issues := total_issues + 1;
      issues_array := array_append(issues_array, json_build_object(
        'type', 'available_margin_error',
        'user_id', user_record.user_id,
        'stored_available', user_record.available_margin,
        'calculated_available', GREATEST(user_record.balance - user_record.used_margin, 0),
        'severity', 'medium'
      ));
    END IF;
  END LOOP;
  SELECT COUNT(*) INTO orphaned_trades
  FROM trades t
  LEFT JOIN user_profiles up ON t.user_id = up.user_id
  WHERE up.user_id IS NULL;
  IF orphaned_trades > 0 THEN
    total_issues := total_issues + 1;
    issues_array := array_append(issues_array, json_build_object(
      'type', 'orphaned_trades',
      'count', orphaned_trades,
      'severity', 'high'
    ));
  END IF;
  SELECT COUNT(*) INTO invalid_orders
  FROM trade_orders to_table
  LEFT JOIN assets a ON to_table.asset_id = a.id
  WHERE a.id IS NULL;
  IF invalid_orders > 0 THEN
    total_issues := total_issues + 1;
    issues_array := array_append(issues_array, json_build_object(
      'type', 'invalid_orders',
      'count', invalid_orders,
      'severity', 'medium'
    ));
  END IF;
  FOR trade_record IN
    SELECT t.user_id, COUNT(*) as trade_count
    FROM trades t
    LEFT JOIN user_profiles up ON t.user_id = up.user_id
    WHERE up.user_id IS NULL
    GROUP BY t.user_id
  LOOP
    total_issues := total_issues + 1;
    issues_array := array_append(issues_array, json_build_object(
      'type', 'user_without_profile',
      'user_id', trade_record.user_id,
      'trade_count', trade_record.trade_count,
      'severity', 'critical'
    ));
  END LOOP;
  health_report := json_build_object(
    'timestamp', now(),
    'status', CASE WHEN total_issues = 0 THEN 'healthy' ELSE 'issues_detected' END,
    'summary', json_build_object(
      'total_users', user_count,
      'total_issues', total_issues,
      'margin_issues', margin_issues,
      'balance_issues', balance_issues,
      'orphaned_trades', orphaned_trades,
      'invalid_orders', invalid_orders
    ),
    'issues', array_to_json(issues_array),
    'recommendations', CASE
      WHEN total_issues > 0 THEN
        json_build_array(
          'Run auto_recalculate_user_margins for affected users',
          'Enable real-time data synchronization',
          'Set up automated health checks',
          'Review data integrity constraints'
        )
      ELSE
        json_build_array('System is healthy')
    END
  );
  RETURN health_report;
END;
$$;
CREATE FUNCTION public.sync_admin_user_relationships() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE user_profiles
  SET admin_id = aur.admin_id
  FROM admin_user_relationships aur
  WHERE user_profiles.user_id = aur.user_id
  AND user_profiles.admin_id IS DISTINCT FROM aur.admin_id;
  INSERT INTO admin_user_relationships (admin_id, user_id)
  SELECT up.admin_id, up.user_id
  FROM user_profiles up
  WHERE up.admin_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM admin_user_relationships aur
    WHERE aur.admin_id = up.admin_id AND aur.user_id = up.user_id
  );
  DELETE FROM admin_user_relationships aur
  WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.user_id = aur.user_id AND up.admin_id = aur.admin_id
  );
END;
$$;
CREATE FUNCTION public.transfer_user_to_admin(_user_id uuid, _new_admin_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _new_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Invalid admin ID or user is not an admin';
  END IF;
  UPDATE user_profiles
  SET
    admin_id = _new_admin_id,
    assignment_method = 'manual',
    assigned_at = now()
  WHERE user_id = _user_id;
  INSERT INTO admin_user_relationships (admin_id, user_id)
  VALUES (_new_admin_id, _user_id)
  ON CONFLICT (user_id)
  DO UPDATE SET admin_id = _new_admin_id;
  RETURN true;
END;
$$;
CREATE FUNCTION public.try_acquire_coordinator_lock(p_instance_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_acquired BOOLEAN := FALSE;
BEGIN
  INSERT INTO coordinator_lock (id, instance_id, locked_at, expires_at, heartbeat_at)
  VALUES ('price-relay', p_instance_id, now(), now() + interval '45 seconds', now())
  ON CONFLICT (id) DO UPDATE
  SET
    instance_id = EXCLUDED.instance_id,
    locked_at = now(),
    expires_at = now() + interval '45 seconds',
    heartbeat_at = now()
  WHERE
    coordinator_lock.instance_id = p_instance_id
    OR coordinator_lock.expires_at < now();
  SELECT (instance_id = p_instance_id) INTO v_acquired
  FROM coordinator_lock
  WHERE id = 'price-relay';
  RETURN COALESCE(v_acquired, FALSE);
END;
$$;
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.update_user_balance_on_trade_close_safe() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  pnl_amount DECIMAL;
BEGIN
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    pnl_amount = NEW.pnl;
    UPDATE user_profiles
    SET
      balance = balance + pnl_amount,
      used_margin = GREATEST(used_margin - NEW.margin_used, 0),
      available_margin = (balance + pnl_amount) - GREATEST(used_margin - NEW.margin_used, 0),
      equity = balance + pnl_amount
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.update_user_balance_on_trade_open_safe() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'open' THEN
    UPDATE user_profiles
    SET
      used_margin = used_margin + NEW.margin_used,
      available_margin = GREATEST(balance - (used_margin + NEW.margin_used), 0)
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.validate_promo_code_for_signup(_promo_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_code record;
  v_error_reason text;
begin
  if _promo_code is null or trim(_promo_code) = '' then
    v_error_reason := 'Promo code cannot be empty';
    insert into promo_validation_attempts (promo_code, was_valid, error_reason)
    values (coalesce(trim(_promo_code), 'EMPTY'), false, v_error_reason);
    return jsonb_build_object('valid', false, 'error', v_error_reason);
  end if;
  select * into v_code
  from promo_codes
  where code = trim(_promo_code);
  if not found then
    v_error_reason := 'Invalid promo code';
  elsif not v_code.is_active then
    v_error_reason := 'Promo code is inactive';
  elsif v_code.expires_at is not null and v_code.expires_at < now() then
    v_error_reason := 'Promo code has expired';
  elsif v_code.max_uses is not null and v_code.current_uses >= v_code.max_uses then
    v_error_reason := 'Promo code usage limit reached';
  elsif not exists (
    select 1 from user_roles
    where user_id = v_code.admin_id and role = 'admin'
  ) then
    v_error_reason := 'Associated admin no longer exists';
  end if;
  if v_error_reason is not null then
    insert into promo_validation_attempts (promo_code, was_valid, error_reason)
    values (trim(_promo_code), false, v_error_reason);
    return jsonb_build_object('valid', false, 'error', v_error_reason);
  end if;
  insert into promo_validation_attempts (promo_code, was_valid)
  values (trim(_promo_code), true);
  return jsonb_build_object(
    'valid', true,
    'admin_id', v_code.admin_id,
    'code_id', v_code.id,
    'admin_name', (select email from user_profiles where user_id = v_code.admin_id)
  );
end;
$$;
CREATE FUNCTION public.validate_role_transition() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'User already has a role assigned. Use UPDATE to change roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.validate_user_balance() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.available_margin = GREATEST(NEW.balance - NEW.used_margin, 0);
  RETURN NEW;
END;
$$;
;

-- ---------- 0002_restore_trading_tables_policies.sql ----------
SET search_path TO public, extensions;
CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    user_id uuid,
    action text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    reason text,
    ip_address inet,
    performed_at timestamp with time zone DEFAULT now(),
    action_details jsonb
);
CREATE TABLE public.admin_payment_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    crypto_wallets jsonb DEFAULT '{}'::jsonb,
    bank_wire_details jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.admin_trading_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    price_intensity text DEFAULT 'medium'::text NOT NULL,
    market_closed boolean DEFAULT false NOT NULL,
    trading_hours_enabled boolean DEFAULT false,
    market_open_time time without time zone DEFAULT '09:30:00'::time without time zone,
    market_close_time time without time zone DEFAULT '16:00:00'::time without time zone,
    trading_timezone text DEFAULT 'America/New_York'::text,
    trading_days text[] DEFAULT ARRAY['monday'::text, 'tuesday'::text, 'wednesday'::text, 'thursday'::text, 'friday'::text],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    margin_call_level integer DEFAULT 100,
    stop_out_level integer DEFAULT 50,
    allow_negative_balance boolean DEFAULT false,
    grace_period_hours integer DEFAULT 24,
    auto_close_enabled boolean DEFAULT true
);
CREATE TABLE public.admin_user_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    symbol text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    price numeric(15,8) NOT NULL,
    change_24h numeric(8,4) DEFAULT 0.0000 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    min_trade_size numeric(10,4) DEFAULT 0.01 NOT NULL,
    max_leverage integer DEFAULT 100 NOT NULL,
    spread numeric(8,4) DEFAULT 0.0001 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contract_size integer DEFAULT 1,
    base_currency text,
    quote_currency text,
    price_updated_at timestamp with time zone DEFAULT now(),
    price_source text DEFAULT 'pending'::text,
    last_ws_update timestamp with time zone DEFAULT now(),
    api_source text DEFAULT 'yahoo'::text,
    api_symbol text,
    CONSTRAINT assets_category_check CHECK ((category = ANY (ARRAY['forex'::text, 'crypto'::text, 'stocks'::text, 'commodities'::text, 'indices'::text])))
);
CREATE TABLE public.bot_licenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    license_key text NOT NULL,
    admin_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    used_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.coordinator_lock (
    id text DEFAULT 'price-relay'::text NOT NULL,
    instance_id text NOT NULL,
    locked_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:00:45'::interval) NOT NULL,
    heartbeat_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT single_lock CHECK ((id = 'price-relay'::text))
);
CREATE TABLE public.deposit_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric NOT NULL,
    deposit_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    crypto_wallet_address text,
    bank_details jsonb,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processed_by_admin uuid,
    CONSTRAINT deposit_requests_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT deposit_requests_deposit_type_check CHECK ((deposit_type = ANY (ARRAY['crypto'::text, 'wire'::text, 'admin_adjustment'::text]))),
    CONSTRAINT deposit_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);
CREATE TABLE public.price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    symbol text NOT NULL,
    price numeric NOT NULL,
    change_24h numeric DEFAULT 0 NOT NULL,
    snapshot_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.promo_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    admin_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    max_uses integer,
    current_uses integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);
CREATE TABLE public.promo_validation_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promo_code text NOT NULL,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    was_valid boolean NOT NULL,
    error_reason text,
    ip_address inet,
    user_agent text,
    resulted_in_signup boolean DEFAULT false,
    created_user_id uuid
);
CREATE TABLE public.trade_execution_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trade_id uuid,
    user_id uuid NOT NULL,
    action text NOT NULL,
    requested_price numeric,
    executed_price numeric,
    slippage_percent numeric,
    execution_source text,
    executed_at timestamp with time zone DEFAULT now(),
    executed_by uuid,
    ip_address inet,
    user_agent text,
    notes text
);
CREATE TABLE public.trade_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    symbol text NOT NULL,
    order_type text DEFAULT 'market'::text NOT NULL,
    trade_type text NOT NULL,
    amount numeric NOT NULL,
    leverage integer DEFAULT 1 NOT NULL,
    trigger_price numeric,
    stop_loss_price numeric,
    take_profit_price numeric,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone,
    filled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    max_slippage_percent numeric DEFAULT 0.5,
    price_at_order numeric
);
CREATE TABLE public.trades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    symbol text NOT NULL,
    trade_type text NOT NULL,
    amount numeric(15,4) NOT NULL,
    leverage integer DEFAULT 1 NOT NULL,
    open_price numeric(15,8) NOT NULL,
    close_price numeric(15,8),
    current_price numeric(15,8),
    pnl numeric(15,2) DEFAULT 0.00,
    margin_used numeric(15,2) NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    trade_source text DEFAULT 'user'::text NOT NULL,
    stop_loss_price numeric,
    take_profit_price numeric,
    parent_order_id uuid,
    idempotency_key uuid,
    version integer DEFAULT 0,
    slippage_percent numeric,
    price_age_ms integer,
    CONSTRAINT trades_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text]))),
    CONSTRAINT trades_trade_source_check CHECK ((trade_source = ANY (ARRAY['bot'::text, 'user'::text]))),
    CONSTRAINT trades_trade_type_check CHECK ((trade_type = ANY (ARRAY['BUY'::text, 'SELL'::text])))
);
CREATE TABLE public.user_bot_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    license_key text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    bot_status text DEFAULT 'active'::text NOT NULL,
    connected_at timestamp with time zone DEFAULT now() NOT NULL,
    permissions jsonb DEFAULT '{"history_access": true, "trade_execution": true, "analytics_access": true}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_bot_status_bot_status_check CHECK ((bot_status = ANY (ARRAY['active'::text, 'paused'::text])))
);
CREATE TABLE public.user_favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_payment_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    admin_id uuid NOT NULL,
    crypto_wallets jsonb DEFAULT '{}'::jsonb,
    bank_wire_details jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    equity numeric(15,2) DEFAULT 0.00 NOT NULL,
    used_margin numeric(15,2) DEFAULT 0.00 NOT NULL,
    available_margin numeric(15,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_id uuid,
    promo_code_used text,
    assignment_method text DEFAULT 'manual'::text,
    assigned_at timestamp with time zone DEFAULT now(),
    first_name text,
    surname text,
    phone_number text,
    last_activity_at timestamp with time zone,
    account_status text DEFAULT 'active'::text,
    grace_period_until timestamp with time zone,
    frozen_at timestamp with time zone,
    frozen_reason text
);
CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.withdrawal_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric NOT NULL,
    withdrawal_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    crypto_wallet_address text,
    bank_details jsonb,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processed_by_admin uuid,
    CONSTRAINT withdrawal_requests_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT withdrawal_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT withdrawal_requests_withdrawal_type_check CHECK ((withdrawal_type = ANY (ARRAY['crypto'::text, 'wire'::text, 'admin_adjustment'::text])))
);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_payment_settings TO authenticated;
GRANT ALL ON public.admin_payment_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_trading_settings TO authenticated;
GRANT ALL ON public.admin_trading_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_user_relationships TO authenticated;
GRANT ALL ON public.admin_user_relationships TO service_role;
GRANT SELECT ON public.assets TO anon, authenticated;
GRANT ALL ON public.assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_licenses TO authenticated;
GRANT ALL ON public.bot_licenses TO service_role;
GRANT ALL ON public.coordinator_lock TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;
GRANT SELECT ON public.price_history TO anon, authenticated;
GRANT ALL ON public.price_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
GRANT SELECT, INSERT ON public.promo_validation_attempts TO authenticated;
GRANT ALL ON public.promo_validation_attempts TO service_role;
GRANT SELECT, INSERT ON public.trade_execution_log TO authenticated;
GRANT ALL ON public.trade_execution_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_orders TO authenticated;
GRANT ALL ON public.trade_orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_bot_status TO authenticated;
GRANT ALL ON public.user_bot_status TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_favorites TO authenticated;
GRANT ALL ON public.user_favorites TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_payment_settings TO authenticated;
GRANT ALL ON public.user_payment_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;

ALTER TABLE ONLY public.admin_audit_log ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_payment_settings ADD CONSTRAINT admin_payment_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_trading_settings ADD CONSTRAINT admin_trading_settings_admin_id_key UNIQUE (admin_id);
ALTER TABLE ONLY public.admin_trading_settings ADD CONSTRAINT admin_trading_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_user_relationships ADD CONSTRAINT admin_user_relationships_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_user_relationships ADD CONSTRAINT admin_user_relationships_user_id_key UNIQUE (user_id);
ALTER TABLE ONLY public.assets ADD CONSTRAINT assets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.assets ADD CONSTRAINT assets_symbol_key UNIQUE (symbol);
ALTER TABLE ONLY public.bot_licenses ADD CONSTRAINT bot_licenses_license_key_key UNIQUE (license_key);
ALTER TABLE ONLY public.bot_licenses ADD CONSTRAINT bot_licenses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.coordinator_lock ADD CONSTRAINT coordinator_lock_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.deposit_requests ADD CONSTRAINT deposit_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.price_history ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.price_history ADD CONSTRAINT price_history_symbol_snapshot_date_key UNIQUE (symbol, snapshot_date);
ALTER TABLE ONLY public.promo_codes ADD CONSTRAINT promo_codes_code_key UNIQUE (code);
ALTER TABLE ONLY public.promo_codes ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.promo_validation_attempts ADD CONSTRAINT promo_validation_attempts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.trade_execution_log ADD CONSTRAINT trade_execution_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.trade_orders ADD CONSTRAINT trade_orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.trades ADD CONSTRAINT trades_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_bot_status ADD CONSTRAINT user_bot_status_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_bot_status ADD CONSTRAINT user_bot_status_user_id_key UNIQUE (user_id);
ALTER TABLE ONLY public.user_favorites ADD CONSTRAINT user_favorites_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_favorites ADD CONSTRAINT user_favorites_user_id_asset_id_key UNIQUE (user_id, asset_id);
ALTER TABLE ONLY public.user_payment_settings ADD CONSTRAINT user_payment_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_payment_settings ADD CONSTRAINT user_payment_settings_user_id_key UNIQUE (user_id);
ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.withdrawal_requests ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);

CREATE INDEX idx_assets_last_ws_update ON public.assets USING btree (last_ws_update);
CREATE INDEX idx_assets_price_source ON public.assets USING btree (price_source);
CREATE INDEX idx_price_history_date ON public.price_history USING btree (snapshot_date DESC);
CREATE INDEX idx_price_history_symbol_date ON public.price_history USING btree (symbol, snapshot_date DESC);
CREATE INDEX idx_promo_validation_attempts_code ON public.promo_validation_attempts USING btree (promo_code);
CREATE INDEX idx_promo_validation_attempts_date ON public.promo_validation_attempts USING btree (attempted_at DESC);
CREATE INDEX idx_trade_execution_log_user_action ON public.trade_execution_log USING btree (user_id, action, executed_at DESC);
CREATE INDEX idx_trade_orders_pending_monitoring ON public.trade_orders USING btree (status, expires_at) WHERE ((status = 'pending'::text) AND (expires_at IS NOT NULL));
CREATE INDEX idx_trade_orders_trigger_price ON public.trade_orders USING btree (trigger_price) WHERE (status = 'pending'::text);
CREATE INDEX idx_trade_orders_user_status ON public.trade_orders USING btree (user_id, status);
CREATE INDEX idx_trades_sl_tp_monitoring ON public.trades USING btree (status, stop_loss_price, take_profit_price, user_id) WHERE ((status = 'open'::text) AND ((stop_loss_price IS NOT NULL) OR (take_profit_price IS NOT NULL)));
CREATE INDEX idx_trades_user_status_opened ON public.trades USING btree (user_id, status, opened_at DESC);
CREATE INDEX idx_user_profiles_last_activity ON public.user_profiles USING btree (last_activity_at);
CREATE UNIQUE INDEX trades_idempotency_key_idx ON public.trades USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE TRIGGER check_margin_before_update BEFORE UPDATE ON public.user_profiles FOR EACH ROW WHEN ((new.available_margin IS DISTINCT FROM old.available_margin)) EXECUTE FUNCTION public.prevent_negative_margin();
CREATE TRIGGER enforce_single_role_per_user BEFORE INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.validate_role_transition();
CREATE TRIGGER final_balance_validation_trigger BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.validate_user_balance();
CREATE TRIGGER final_timestamp_trigger BEFORE UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER prevent_user_financial_updates_trigger BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_user_financial_updates();
CREATE TRIGGER tr_handle_trade_closed AFTER UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.handle_trade_closed();
CREATE TRIGGER tr_handle_trade_opened AFTER INSERT ON public.trades FOR EACH ROW EXECUTE FUNCTION public.handle_trade_opened();
CREATE TRIGGER trigger_profile_changes AFTER UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.notify_profile_changes();
CREATE TRIGGER trigger_validate_user_balance BEFORE INSERT OR UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.validate_user_balance();
CREATE TRIGGER update_admin_payment_settings_updated_at BEFORE UPDATE ON public.admin_payment_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_admin_trading_settings_updated_at BEFORE UPDATE ON public.admin_trading_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bot_licenses_updated_at BEFORE UPDATE ON public.bot_licenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trade_orders_updated_at BEFORE UPDATE ON public.trade_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_bot_status_updated_at BEFORE UPDATE ON public.user_bot_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_payment_settings_updated_at BEFORE UPDATE ON public.user_payment_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.user_profiles(user_id) ON DELETE SET NULL;
ALTER TABLE ONLY public.admin_user_relationships ADD CONSTRAINT admin_user_relationships_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.admin_user_relationships ADD CONSTRAINT fk_admin_user_relationships_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.deposit_requests ADD CONSTRAINT fk_deposit_requests_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.trade_orders ADD CONSTRAINT fk_trade_orders_assets FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.trade_orders ADD CONSTRAINT fk_trade_orders_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.trades ADD CONSTRAINT fk_trades_parent_order FOREIGN KEY (parent_order_id) REFERENCES public.trade_orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.trades ADD CONSTRAINT fk_trades_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.trades ADD CONSTRAINT trades_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);
ALTER TABLE ONLY public.user_bot_status ADD CONSTRAINT fk_user_bot_status_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_favorites ADD CONSTRAINT fk_user_favorites_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_favorites ADD CONSTRAINT user_favorites_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.withdrawal_requests ADD CONSTRAINT fk_withdrawal_requests_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.promo_codes ADD CONSTRAINT promo_codes_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.trade_execution_log ADD CONSTRAINT trade_execution_log_trade_id_fkey FOREIGN KEY (trade_id) REFERENCES public.trades(id) ON DELETE CASCADE;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_trading_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordinator_lock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_validation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bot_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can delete assigned users trades" ON public.trades FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = trades.user_id))))));
CREATE POLICY "Admins can delete payment settings for their users" ON public.user_payment_settings FOR DELETE TO authenticated USING (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can insert audit entries" ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK ((auth.uid() = admin_id));
CREATE POLICY "Admins can insert payment settings for their users" ON public.user_payment_settings FOR INSERT TO authenticated WITH CHECK (((auth.uid() = admin_id) AND (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = user_payment_settings.user_id)))))));
CREATE POLICY "Admins can manage own trading settings" ON public.admin_trading_settings TO authenticated USING (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can manage their own licenses" ON public.bot_licenses TO authenticated USING (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can manage their own payment settings" ON public.admin_payment_settings TO authenticated USING (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Users can read their admin payment settings" ON public.admin_payment_settings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = admin_payment_settings.admin_id) AND (admin_user_relationships.user_id = auth.uid())))));
CREATE POLICY "Admins can manage their own promo codes" ON public.promo_codes TO authenticated USING (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can update assigned user deposit requests only" ON public.deposit_requests FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = deposit_requests.user_id)))))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = deposit_requests.user_id))))));
CREATE POLICY "Admins can update assigned users only" ON public.user_profiles FOR UPDATE TO authenticated USING (((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)) AND ((EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = user_profiles.user_id)))) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)))) WITH CHECK (((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)) AND ((EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = user_profiles.user_id)))) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))));
CREATE POLICY "Admins can update assigned users' trades" ON public.trades FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = trades.user_id)))))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = trades.user_id))))));
CREATE POLICY "Admins can update payment settings for their users" ON public.user_payment_settings FOR UPDATE TO authenticated USING (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can update withdrawal requests for their users" ON public.withdrawal_requests FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = withdrawal_requests.user_id))))));
CREATE POLICY "Admins can view assigned user profiles only" ON public.user_profiles FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = user_profiles.user_id))))));
CREATE POLICY "Admins can view assigned users trade orders" ON public.trade_orders FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = trade_orders.user_id))))));
CREATE POLICY "Admins can view payment settings for their users" ON public.user_payment_settings FOR SELECT TO authenticated USING (((auth.uid() = admin_id) OR (auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can view their user relationships" ON public.admin_user_relationships FOR SELECT TO authenticated USING (((auth.uid() = admin_id) OR (auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can view their users' bot status" ON public.user_bot_status FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = user_bot_status.user_id))))));
CREATE POLICY "Admins can view validation attempts" ON public.promo_validation_attempts FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Assets are viewable by everyone" ON public.assets FOR SELECT USING (true);
CREATE POLICY "Price history is viewable by everyone" ON public.price_history FOR SELECT USING (true);
CREATE POLICY "Super admins can manage all relationships" ON public.admin_user_relationships TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admins can manage all roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admins can update any profile" ON public.user_profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admins can view admin audit" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR auth.uid() = admin_id);
CREATE POLICY "Super admins can view all profiles" ON public.user_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admins can view audit logs" ON public.trade_execution_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR auth.uid() = user_id);
CREATE POLICY "Users can insert own execution logs" ON public.trade_execution_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users and admins can create deposit requests" ON public.deposit_requests FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = deposit_requests.user_id))))));
CREATE POLICY "Users and admins can create withdrawal requests" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = withdrawal_requests.user_id))))));
CREATE POLICY "Users and their admins can view trades" ON public.trades FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = trades.user_id))))));
CREATE POLICY "Users can create their own trade orders" ON public.trade_orders FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can create their own trades" ON public.trades FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can insert own profile only" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can manage their own bot status" ON public.user_bot_status TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can manage their own favorites" ON public.user_favorites TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can read their admin trading settings" ON public.admin_trading_settings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = admin_trading_settings.admin_id) AND (admin_user_relationships.user_id = auth.uid())))));
CREATE POLICY "Users can update own basic info only" ON public.user_profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own trade orders" ON public.trade_orders FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own trades" ON public.trades FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view licenses they're using" ON public.bot_licenses FOR SELECT TO authenticated USING (((auth.uid() = used_by_user_id) OR (auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Users can view own deposit requests only" ON public.deposit_requests FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = deposit_requests.user_id))))));
CREATE POLICY "Users can view own profile only" ON public.user_profiles FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "Users can view their own trade orders" ON public.trade_orders FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own withdrawal requests" ON public.withdrawal_requests FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = withdrawal_requests.user_id))))));

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_promo_code_for_signup(text) TO anon;
REVOKE EXECUTE ON FUNCTION public.try_acquire_coordinator_lock(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.renew_coordinator_lock(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.release_coordinator_lock(text) FROM authenticated;
;

-- ---------- 0003_signup_setup_mode.sql ----------
SET search_path TO public, extensions;
CREATE OR REPLACE FUNCTION public.signup_requires_promo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('admin', 'super_admin'));
$$;
REVOKE EXECUTE ON FUNCTION public.signup_requires_promo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.signup_requires_promo() TO anon, authenticated, service_role;
;

-- ---------- 0004_fix_financial_guard_for_internal_updates.sql ----------
SET search_path TO public, extensions;
CREATE OR REPLACE FUNCTION public.prevent_user_financial_updates() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only block direct edits made by a signed-in user through the API.
  -- Updates performed inside trusted database functions run as the function owner and are allowed.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() = NEW.user_id AND NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    NEW.balance = OLD.balance;
    NEW.equity = OLD.equity;
    NEW.used_margin = OLD.used_margin;
    NEW.available_margin = OLD.available_margin;
    NEW.admin_id = OLD.admin_id;
    NEW.promo_code_used = OLD.promo_code_used;
    NEW.assignment_method = OLD.assignment_method;
    NEW.assigned_at = OLD.assigned_at;
    NEW.account_status = OLD.account_status;
    NEW.grace_period_until = OLD.grace_period_until;
    NEW.frozen_at = OLD.frozen_at;
    NEW.frozen_reason = OLD.frozen_reason;
  END IF;
  RETURN NEW;
END;
$$;
;

-- ---------- 0005_revoke_internal_function_access.sql ----------
SET search_path TO public, extensions;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_trade_closed() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_trade_opened() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_profile_changes() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_balance_on_trade_close_safe() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_balance_on_trade_open_safe() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_role_transition() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_user_margins(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_liquidate_positions(uuid) FROM authenticated;
;

-- ---------- 0006_price_feed_candles_and_lot_based_risk.sql ----------
SET search_path TO public, extensions;
-- Own chart data: 5-minute candles built from our price feed
CREATE TABLE IF NOT EXISTS public.price_candles (
  symbol text NOT NULL,
  bucket timestamptz NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  PRIMARY KEY (symbol, bucket)
);
GRANT SELECT ON public.price_candles TO anon, authenticated;
GRANT ALL ON public.price_candles TO service_role;
ALTER TABLE public.price_candles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read candles" ON public.price_candles FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS price_candles_bucket_idx ON public.price_candles (bucket);

-- Store prices + candles in one call from the price feed
CREATE OR REPLACE FUNCTION public.ingest_prices(_prices jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _n integer;
  _bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / 300) * 300);
BEGIN
  WITH p AS (
    SELECT x->>'symbol' AS symbol, (x->>'price')::numeric AS price,
           NULLIF(x->>'change', '')::numeric AS change, x->>'source' AS source
    FROM jsonb_array_elements(_prices) x
    WHERE (x->>'price')::numeric > 0
  ), u AS (
    UPDATE assets a SET price = p.price,
      change_24h = COALESCE(p.change, a.change_24h),
      price_updated_at = now(), price_source = p.source, updated_at = now()
    FROM p WHERE a.symbol = p.symbol
    RETURNING a.symbol, p.price
  ), c AS (
    INSERT INTO price_candles AS pc (symbol, bucket, open, high, low, close)
    SELECT symbol, _bucket, price, price, price, price FROM u
    ON CONFLICT (symbol, bucket) DO UPDATE SET
      high = GREATEST(pc.high, EXCLUDED.close),
      low = LEAST(pc.low, EXCLUDED.close),
      close = EXCLUDED.close
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM c;
  RETURN _n;
END;
$$;

-- Backfill historic candles (close-only points) without overwriting live ones
CREATE OR REPLACE FUNCTION public.backfill_candles(_candles jsonb)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ins AS (
    INSERT INTO price_candles (symbol, bucket, open, high, low, close)
    SELECT x->>'symbol', to_timestamp((x->>'t')::bigint),
      (x->>'o')::numeric, (x->>'h')::numeric, (x->>'l')::numeric, (x->>'c')::numeric
    FROM jsonb_array_elements(_candles) x
    WHERE (x->>'c')::numeric > 0
    ON CONFLICT DO NOTHING
    RETURNING 1
  ) SELECT count(*)::int FROM ins;
$$;

-- Lot-based P&L: price difference x lots x contract size (leverage only affects margin)
CREATE OR REPLACE FUNCTION public.calc_trade_pnl(_trade_type text, _lots numeric, _contract_size numeric, _open numeric, _price numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN upper(_trade_type) = 'BUY' THEN (_price - _open) ELSE (_open - _price) END
         * _lots * COALESCE(NULLIF(_contract_size, 0), 1);
$$;

CREATE OR REPLACE FUNCTION public.calculate_pnl(trade_type text, amount numeric, open_price numeric, current_price numeric, leverage_param numeric DEFAULT 1)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  -- Kept for compatibility; contract size is applied by callers that know the asset
  SELECT public.calc_trade_pnl(trade_type, amount, 1, open_price, current_price);
$$;

CREATE OR REPLACE FUNCTION public.close_trade_with_pnl(p_trade_id uuid, p_close_price numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trade RECORD;
  v_market numeric;
  v_contract numeric;
  v_price numeric;
  v_pnl numeric;
  v_balance numeric;
BEGIN
  SELECT * INTO v_trade FROM trades WHERE id = p_trade_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Trade not found or already closed');
  END IF;
  IF auth.uid() IS NOT NULL AND v_trade.user_id IS DISTINCT FROM auth.uid()
     AND NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  SELECT price, contract_size INTO v_market, v_contract FROM assets WHERE id = v_trade.asset_id;
  -- Server price is the authority: a client price is only accepted within 0.25% of the market
  IF v_market IS NULL OR v_market <= 0 THEN
    v_price := p_close_price;
  ELSIF p_close_price IS NULL OR p_close_price <= 0 OR abs(p_close_price - v_market) / v_market > 0.0025 THEN
    v_price := v_market;
  ELSE
    v_price := p_close_price;
  END IF;

  v_pnl := round(calc_trade_pnl(v_trade.trade_type, v_trade.amount, v_contract, v_trade.open_price, v_price), 2);

  UPDATE trades SET status = 'closed', close_price = v_price, current_price = v_price, pnl = v_pnl,
    closed_at = now(), updated_at = now(), version = version + 1
  WHERE id = p_trade_id;

  UPDATE user_profiles SET
    balance = balance + v_pnl,
    used_margin = GREATEST(used_margin - v_trade.margin_used, 0),
    equity = balance + v_pnl,
    available_margin = GREATEST((balance + v_pnl) - GREATEST(used_margin - v_trade.margin_used, 0), 0),
    updated_at = now()
  WHERE user_id = v_trade.user_id
  RETURNING balance INTO v_balance;

  RETURN jsonb_build_object('success', true, 'pnl', v_pnl, 'close_price', v_price, 'new_balance', v_balance);
END;
$$;

-- Server-side stop-loss / take-profit and margin call / stop-out, run after every price update
CREATE OR REPLACE FUNCTION public.process_price_triggers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t RECORD;
  u RECORD;
  s RECORD;
  v_sltp integer := 0;
  v_stopouts integer := 0;
  v_equity numeric;
  v_used numeric;
  v_level numeric;
  v_worst uuid;
BEGIN
  -- 1. Stop-loss / take-profit at the real market price
  FOR t IN
    SELECT tr.id FROM trades tr JOIN assets a ON a.id = tr.asset_id
    WHERE tr.status = 'open' AND a.price > 0 AND (
      (upper(tr.trade_type) = 'BUY'  AND ((tr.stop_loss_price > 0 AND a.price <= tr.stop_loss_price) OR (tr.take_profit_price > 0 AND a.price >= tr.take_profit_price))) OR
      (upper(tr.trade_type) = 'SELL' AND ((tr.stop_loss_price > 0 AND a.price >= tr.stop_loss_price) OR (tr.take_profit_price > 0 AND a.price <= tr.take_profit_price)))
    )
  LOOP
    PERFORM close_trade_with_pnl(t.id, NULL);
    v_sltp := v_sltp + 1;
  END LOOP;

  -- 2. Keep open trade P&L fresh for admins
  UPDATE trades tr SET current_price = a.price,
    pnl = round(calc_trade_pnl(tr.trade_type, tr.amount, a.contract_size, tr.open_price, a.price), 2)
  FROM assets a WHERE a.id = tr.asset_id AND tr.status = 'open' AND a.price > 0;

  -- 3. Margin call / grace period / stop-out per account
  FOR u IN
    SELECT p.user_id, p.balance, p.admin_id, p.account_status, p.grace_period_until
    FROM user_profiles p WHERE EXISTS (SELECT 1 FROM trades x WHERE x.user_id = p.user_id AND x.status = 'open')
  LOOP
    SELECT COALESCE(margin_call_level, 100) AS mc, COALESCE(stop_out_level, 50) AS so,
           COALESCE(grace_period_hours, 0) AS gh, COALESCE(auto_close_enabled, true) AS ac,
           COALESCE(allow_negative_balance, false) AS neg
    INTO s FROM admin_trading_settings WHERE admin_id = u.admin_id;
    IF NOT FOUND THEN
      s := ROW(100, 50, 0, true, false);
    END IF;

    LOOP
      SELECT COALESCE(sum(pnl), 0), COALESCE(sum(margin_used), 0) INTO v_equity, v_used
      FROM trades WHERE user_id = u.user_id AND status = 'open';
      v_equity := (SELECT balance FROM user_profiles WHERE user_id = u.user_id) + v_equity;
      EXIT WHEN v_used <= 0;
      v_level := v_equity / v_used * 100;

      IF v_level > s.mc THEN
        UPDATE user_profiles SET account_status = 'active', grace_period_until = NULL, equity = v_equity
        WHERE user_id = u.user_id AND (account_status IS DISTINCT FROM 'active' OR equity IS DISTINCT FROM v_equity);
        EXIT;
      ELSIF v_level > s.so THEN
        UPDATE user_profiles SET account_status = 'margin_call', equity = v_equity WHERE user_id = u.user_id;
        EXIT;
      END IF;

      -- At or below stop-out
      IF s.gh > 0 AND (u.grace_period_until IS NULL OR u.grace_period_until > now()) THEN
        UPDATE user_profiles SET account_status = 'grace', equity = v_equity,
          grace_period_until = COALESCE(grace_period_until, now() + make_interval(hours => s.gh))
        WHERE user_id = u.user_id;
        EXIT;
      END IF;
      EXIT WHEN NOT s.ac;

      -- Close the biggest losing trade first, then re-check
      SELECT id INTO v_worst FROM trades WHERE user_id = u.user_id AND status = 'open' ORDER BY pnl ASC LIMIT 1;
      EXIT WHEN v_worst IS NULL;
      PERFORM close_trade_with_pnl(v_worst, NULL);
      v_stopouts := v_stopouts + 1;
      UPDATE user_profiles SET account_status = 'stopped_out', grace_period_until = NULL WHERE user_id = u.user_id;
    END LOOP;

    IF NOT s.neg THEN
      UPDATE user_profiles SET balance = 0, equity = GREATEST(equity, 0), available_margin = 0
      WHERE user_id = u.user_id AND balance < 0
        AND NOT EXISTS (SELECT 1 FROM trades x WHERE x.user_id = u.user_id AND x.status = 'open');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('sltp_closed', v_sltp, 'stopout_closed', v_stopouts);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ingest_prices(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backfill_candles(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_price_triggers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_prices(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_candles(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_price_triggers() TO service_role;
GRANT EXECUTE ON FUNCTION public.calc_trade_pnl(text, numeric, numeric, numeric, numeric) TO anon, authenticated, service_role;

-- Old liquidation used balance only (ignored open losses); delegate to the new risk engine
CREATE OR REPLACE FUNCTION public.check_and_liquidate_positions(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN json_build_object('stop_out_triggered', false, 'note', 'handled by process_price_triggers');
END;
$$;

-- Coordinator lock RPCs are only for the server
DO $$ BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.acquire_coordinator_lock(text) FROM PUBLIC, anon, authenticated';
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.renew_coordinator_lock(text) FROM PUBLIC, anon, authenticated';
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.release_coordinator_lock(text) FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
;

-- ---------- 0007_authoritative_trade_open_pricing.sql ----------
SET search_path TO public, extensions;
-- Every new open trade gets its price checked against the market and its margin computed from lots x contract size
CREATE OR REPLACE FUNCTION public.enforce_trade_open_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_market numeric;
  v_contract numeric;
  v_available numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM 'open' THEN
    RETURN NEW;
  END IF;
  SELECT price, COALESCE(NULLIF(contract_size, 0), 1) INTO v_market, v_contract FROM assets WHERE id = NEW.asset_id;
  IF v_market > 0 AND (NEW.open_price IS NULL OR NEW.open_price <= 0 OR abs(NEW.open_price - v_market) / v_market > 0.0025) THEN
    NEW.open_price := v_market;
  END IF;
  NEW.current_price := NEW.open_price;
  NEW.margin_used := round(NEW.amount * v_contract * NEW.open_price / GREATEST(COALESCE(NEW.leverage, 1), 1), 2);
  SELECT available_margin INTO v_available FROM user_profiles WHERE user_id = NEW.user_id;
  IF v_available IS NULL OR v_available < NEW.margin_used THEN
    RAISE EXCEPTION 'Insufficient margin. Required: %, available: %', NEW.margin_used, COALESCE(v_available, 0);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_trade_open_rules() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enforce_trade_open_rules ON public.trades;
CREATE TRIGGER trg_enforce_trade_open_rules BEFORE INSERT ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.enforce_trade_open_rules();

-- Fix defaults record in the risk engine (unnamed ROW() fields could not be read)
CREATE OR REPLACE FUNCTION public.get_risk_settings(_admin_id uuid)
RETURNS TABLE(mc integer, so integer, gh integer, ac boolean, neg boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(s.margin_call_level, 100), COALESCE(s.stop_out_level, 50), COALESCE(s.grace_period_hours, 0),
         COALESCE(s.auto_close_enabled, true), COALESCE(s.allow_negative_balance, false)
  FROM (SELECT 1) d LEFT JOIN admin_trading_settings s ON s.admin_id = _admin_id
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_risk_settings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_risk_settings(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.process_price_triggers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t RECORD;
  u RECORD;
  s RECORD;
  v_sltp integer := 0;
  v_stopouts integer := 0;
  v_equity numeric;
  v_used numeric;
  v_level numeric;
  v_worst uuid;
BEGIN
  FOR t IN
    SELECT tr.id FROM trades tr JOIN assets a ON a.id = tr.asset_id
    WHERE tr.status = 'open' AND a.price > 0 AND (
      (upper(tr.trade_type) = 'BUY'  AND ((tr.stop_loss_price > 0 AND a.price <= tr.stop_loss_price) OR (tr.take_profit_price > 0 AND a.price >= tr.take_profit_price))) OR
      (upper(tr.trade_type) = 'SELL' AND ((tr.stop_loss_price > 0 AND a.price >= tr.stop_loss_price) OR (tr.take_profit_price > 0 AND a.price <= tr.take_profit_price)))
    )
  LOOP
    PERFORM close_trade_with_pnl(t.id, NULL);
    v_sltp := v_sltp + 1;
  END LOOP;

  UPDATE trades tr SET current_price = a.price,
    pnl = round(calc_trade_pnl(tr.trade_type, tr.amount, a.contract_size, tr.open_price, a.price), 2)
  FROM assets a WHERE a.id = tr.asset_id AND tr.status = 'open' AND a.price > 0;

  FOR u IN
    SELECT p.user_id, p.admin_id, p.grace_period_until
    FROM user_profiles p WHERE EXISTS (SELECT 1 FROM trades x WHERE x.user_id = p.user_id AND x.status = 'open')
  LOOP
    SELECT * INTO s FROM get_risk_settings(u.admin_id);
    LOOP
      SELECT COALESCE(sum(pnl), 0), COALESCE(sum(margin_used), 0) INTO v_equity, v_used
      FROM trades WHERE user_id = u.user_id AND status = 'open';
      v_equity := (SELECT balance FROM user_profiles WHERE user_id = u.user_id) + v_equity;
      EXIT WHEN v_used <= 0;
      v_level := v_equity / v_used * 100;

      IF v_level > s.mc THEN
        UPDATE user_profiles SET account_status = 'active', grace_period_until = NULL, equity = v_equity WHERE user_id = u.user_id;
        EXIT;
      ELSIF v_level > s.so THEN
        UPDATE user_profiles SET account_status = 'margin_call', equity = v_equity WHERE user_id = u.user_id;
        EXIT;
      END IF;

      IF s.gh > 0 AND (u.grace_period_until IS NULL OR u.grace_period_until > now()) THEN
        UPDATE user_profiles SET account_status = 'grace', equity = v_equity,
          grace_period_until = COALESCE(grace_period_until, now() + make_interval(hours => s.gh))
        WHERE user_id = u.user_id;
        EXIT;
      END IF;
      EXIT WHEN NOT s.ac;

      SELECT id INTO v_worst FROM trades WHERE user_id = u.user_id AND status = 'open' ORDER BY pnl ASC LIMIT 1;
      EXIT WHEN v_worst IS NULL;
      PERFORM close_trade_with_pnl(v_worst, NULL);
      v_stopouts := v_stopouts + 1;
      UPDATE user_profiles SET account_status = 'stopped_out', grace_period_until = NULL WHERE user_id = u.user_id;
    END LOOP;

    IF NOT s.neg THEN
      UPDATE user_profiles SET balance = 0, equity = 0, available_margin = 0
      WHERE user_id = u.user_id AND balance < 0
        AND NOT EXISTS (SELECT 1 FROM trades x WHERE x.user_id = u.user_id AND x.status = 'open');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('sltp_closed', v_sltp, 'stopout_closed', v_stopouts);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.process_price_triggers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_price_triggers() TO service_role;
;

-- ---------- 0008_candle_helpers.sql ----------
SET search_path TO public, extensions;
CREATE OR REPLACE FUNCTION public.symbols_missing_history(_since timestamptz)
RETURNS TABLE(symbol text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.symbol FROM assets a
  WHERE a.is_active AND NOT EXISTS (
    SELECT 1 FROM price_candles c WHERE c.symbol = a.symbol AND c.bucket < _since)
  ORDER BY a.symbol;
$$;
REVOKE EXECUTE ON FUNCTION public.symbols_missing_history(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.symbols_missing_history(timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.get_candles(_symbol text, _seconds integer, _since timestamptz)
RETURNS TABLE(t bigint, open numeric, high numeric, low numeric, close numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT extract(epoch FROM b)::bigint,
    (array_agg(c.open ORDER BY c.bucket))[1], max(c.high), min(c.low),
    (array_agg(c.close ORDER BY c.bucket DESC))[1]
  FROM (SELECT *, date_bin(make_interval(secs => greatest(_seconds,300)), bucket, 'epoch'::timestamptz) b
        FROM price_candles WHERE symbol = _symbol AND bucket >= _since) c
  GROUP BY b ORDER BY b
  LIMIT 5000;
$$;
GRANT EXECUTE ON FUNCTION public.get_candles(text, integer, timestamptz) TO anon, authenticated, service_role;
;

-- ---------- 0009_migration.sql ----------
SET search_path TO public, extensions;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS price_changed_at timestamptz;
UPDATE public.assets SET price_changed_at = price_updated_at WHERE price_changed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.price_feed_runs (
  id bigserial PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer NOT NULL,
  markets_total integer NOT NULL,
  markets_updated integer NOT NULL,
  missing text[] NOT NULL DEFAULT '{}',
  by_source jsonb NOT NULL DEFAULT '{}',
  provider_calls jsonb NOT NULL DEFAULT '{}',
  rejected jsonb NOT NULL DEFAULT '[]',
  errors text[] NOT NULL DEFAULT '{}',
  backfilled integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS price_feed_runs_ran_at_idx ON public.price_feed_runs (ran_at DESC);
ALTER TABLE public.price_feed_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.price_feed_runs TO authenticated;
GRANT ALL ON public.price_feed_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.price_feed_runs_id_seq TO service_role;
CREATE POLICY "Admins read feed runs" ON public.price_feed_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.ingest_prices_v2(_prices jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _n integer;
  _rejected jsonb;
  _bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / 300) * 300);
BEGIN
  DROP TABLE IF EXISTS _p;
  CREATE TEMP TABLE _p ON COMMIT DROP AS
  SELECT x->>'symbol' AS symbol, (x->>'price')::numeric AS price,
         NULLIF(x->>'change', '')::numeric AS change, x->>'source' AS source,
         a.price AS old_price, a.category, a.price_changed_at,
         (a.price > 0 AND a.price_changed_at > now() - interval '3 days'
           AND abs((x->>'price')::numeric - a.price) / a.price > CASE WHEN a.category = 'crypto' THEN 0.30 ELSE 0.20 END) AS outlier
  FROM jsonb_array_elements(_prices) x
  JOIN assets a ON a.symbol = x->>'symbol'
  WHERE (x->>'price')::numeric > 0;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('symbol', symbol, 'old', old_price, 'new', price, 'source', source)), '[]')
  INTO _rejected FROM _p WHERE outlier;

  WITH u AS (
    UPDATE assets a SET price = p.price,
      change_24h = COALESCE(p.change, a.change_24h),
      price_changed_at = CASE WHEN p.price <> a.price OR a.price_changed_at IS NULL THEN now() ELSE a.price_changed_at END,
      price_updated_at = now(), price_source = p.source, updated_at = now()
    FROM _p p WHERE a.symbol = p.symbol AND NOT p.outlier
    RETURNING a.symbol, p.price
  ), c AS (
    INSERT INTO price_candles AS pc (symbol, bucket, open, high, low, close)
    SELECT symbol, _bucket, price, price, price, price FROM u
    ON CONFLICT (symbol, bucket) DO UPDATE SET
      high = GREATEST(pc.high, EXCLUDED.close),
      low = LEAST(pc.low, EXCLUDED.close),
      close = EXCLUDED.close
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM c;
  RETURN jsonb_build_object('stored', _n, 'rejected', _rejected);
END $$;
REVOKE ALL ON FUNCTION public.ingest_prices_v2(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_prices_v2(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.get_market_health()
RETURNS TABLE(symbol text, category text, price numeric, price_source text, updated_age_s integer,
              changed_age_s integer, candles_24h integer, status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN QUERY
  SELECT a.symbol, a.category, a.price, a.price_source,
    extract(epoch from now() - a.price_updated_at)::int,
    extract(epoch from now() - a.price_changed_at)::int,
    (SELECT count(*)::int FROM price_candles pc WHERE pc.symbol = a.symbol AND pc.bucket > now() - interval '24 hours'),
    CASE
      WHEN a.price IS NULL OR a.price <= 0 THEN 'bad_price'
      WHEN a.price_updated_at IS NULL OR a.price_updated_at < now() - interval '5 minutes' THEN 'stale'
      WHEN a.category = 'crypto' AND a.price_changed_at < now() - interval '30 minutes' THEN 'frozen'
      WHEN a.price_changed_at < now() - interval '30 minutes' THEN 'closed'
      ELSE 'live'
    END
  FROM assets a WHERE a.is_active ORDER BY a.category, a.symbol;
END $$;
REVOKE ALL ON FUNCTION public.get_market_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_market_health() TO authenticated;
;

-- ---------- 0010_market_intelligence.sql ----------
SET search_path TO public, extensions;
CREATE TABLE public.price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  symbol text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('above','below')),
  target_price numeric NOT NULL CHECK (target_price > 0),
  is_active boolean NOT NULL DEFAULT true,
  triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_alerts TO authenticated;
GRANT ALL ON public.price_alerts TO service_role;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts" ON public.price_alerts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX ON public.price_alerts (user_id, is_active);

CREATE TABLE public.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlists TO authenticated;
GRANT ALL ON public.watchlists TO service_role;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watchlists" ON public.watchlists FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (watchlist_id, asset_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_items TO authenticated;
GRANT ALL ON public.watchlist_items TO service_role;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watchlist items" ON public.watchlist_items FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND w.user_id = auth.uid()));

INSERT INTO public.watchlists (user_id, name, sort_order)
SELECT DISTINCT user_id, 'Favorites', 0 FROM public.user_favorites;
INSERT INTO public.watchlist_items (watchlist_id, user_id, asset_id)
SELECT w.id, f.user_id, f.asset_id FROM public.user_favorites f
JOIN public.watchlists w ON w.user_id = f.user_id AND w.name = 'Favorites'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_market_sentiment(_symbol text)
RETURNS TABLE(traders integer, buy_lots numeric, sell_lots numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(DISTINCT user_id)::int,
    COALESCE(sum(amount) FILTER (WHERE upper(trade_type)='BUY'),0),
    COALESCE(sum(amount) FILTER (WHERE upper(trade_type)='SELL'),0)
  FROM trades WHERE symbol = _symbol AND status = 'open'
  HAVING count(DISTINCT user_id) >= 5;
$$;
REVOKE ALL ON FUNCTION public.get_market_sentiment(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_market_sentiment(text) TO authenticated;
;

-- ---------- 0011_restrict_price_candles_to_signed_in.sql ----------
SET search_path TO public, extensions;
DROP POLICY IF EXISTS "Anyone can read candles" ON public.price_candles;
REVOKE SELECT ON public.price_candles FROM anon;
GRANT SELECT ON public.price_candles TO authenticated;
CREATE POLICY "Signed-in users can read candles" ON public.price_candles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
;

-- ---------- 0012_market_hours_and_pending_orders.sql ----------
SET search_path TO public, extensions;
ALTER TABLE public.trade_orders ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.trade_orders ADD COLUMN IF NOT EXISTS filled_trade_id uuid;

CREATE OR REPLACE FUNCTION public.is_market_open(_symbol text, _category text, _ts timestamptz DEFAULT now())
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  tz text; o int; c int; loc timestamp; dow int; m int;
BEGIN
  IF _category = 'crypto' THEN RETURN true; END IF;
  IF _category IN ('forex','commodities') THEN
    loc := _ts AT TIME ZONE 'America/New_York';
    dow := extract(dow from loc)::int; m := extract(hour from loc)::int*60 + extract(minute from loc)::int;
    o := CASE WHEN _category = 'forex' THEN 17*60 ELSE 18*60 END;
    IF dow = 6 THEN RETURN false; END IF;
    IF dow = 0 THEN RETURN m >= o; END IF;
    IF dow = 5 THEN RETURN m < 17*60; END IF;
    IF _category = 'commodities' AND m >= 17*60 AND m < 18*60 THEN RETURN false; END IF;
    RETURN true;
  END IF;
  -- daily exchange sessions
  SELECT x.tz, x.o, x.c INTO tz, o, c FROM (VALUES
    ('UK100','Europe/London',480,990),
    ('GER40','Europe/Berlin',540,1050),('FRA40','Europe/Paris',540,1050),('EU50','Europe/Berlin',540,1050),
    ('ITA40','Europe/Rome',540,1050),('ESP35','Europe/Madrid',540,1050),('NED25','Europe/Amsterdam',540,1050),
    ('SUI20','Europe/Zurich',540,1050),('JPN225','Asia/Tokyo',540,930),('HK50','Asia/Hong_Kong',570,960),
    ('CHINA50','Asia/Shanghai',570,900),('AUS200','Australia/Sydney',600,960),('IND50','Asia/Kolkata',555,930),
    ('KOR200','Asia/Seoul',540,930),('CAN60','America/Toronto',570,960),('BRA50','America/Sao_Paulo',600,1020)
  ) AS x(sym,tz,o,c) WHERE x.sym = _symbol;
  IF tz IS NULL THEN tz := 'America/New_York'; o := 570; c := 960; END IF;
  loc := _ts AT TIME ZONE tz;
  dow := extract(dow from loc)::int; m := extract(hour from loc)::int*60 + extract(minute from loc)::int;
  RETURN dow BETWEEN 1 AND 5 AND m >= o AND m < c;
END $$;
GRANT EXECUTE ON FUNCTION public.is_market_open(text,text,timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_trade_open_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_market numeric; v_contract numeric; v_available numeric; v_cat text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'open' THEN RETURN NEW; END IF;
  SELECT price, COALESCE(NULLIF(contract_size, 0), 1), category INTO v_market, v_contract, v_cat FROM assets WHERE id = NEW.asset_id;
  IF current_user IN ('authenticated','service_role') AND NOT is_market_open(NEW.symbol, v_cat, now()) THEN
    RAISE EXCEPTION 'Market closed. You can place a pending order instead.';
  END IF;
  IF v_market > 0 AND (NEW.open_price IS NULL OR NEW.open_price <= 0 OR abs(NEW.open_price - v_market) / v_market > 0.0025) THEN
    NEW.open_price := v_market;
  END IF;
  NEW.current_price := NEW.open_price;
  NEW.margin_used := round(NEW.amount * v_contract * NEW.open_price / GREATEST(COALESCE(NEW.leverage, 1), 1), 2);
  SELECT available_margin INTO v_available FROM user_profiles WHERE user_id = NEW.user_id;
  IF v_available IS NULL OR v_available < NEW.margin_used THEN
    RAISE EXCEPTION 'Insufficient margin. Required: %, available: %', NEW.margin_used, COALESCE(v_available, 0);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_trade_order_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user <> 'authenticated' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.order_type NOT IN ('limit','stop') OR NEW.trigger_price IS NULL OR NEW.trigger_price <= 0 OR NEW.amount <= 0 THEN
      RAISE EXCEPTION 'Invalid pending order';
    END IF;
    NEW.status := 'pending'; NEW.filled_at := NULL; NEW.filled_trade_id := NULL; NEW.cancel_reason := NULL;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'pending' OR NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Only pending orders can be cancelled';
  END IF;
  RETURN OLD #= hstore(ARRAY['status','cancel_reason','updated_at'], ARRAY['cancelled','Cancelled by you', now()::text]);
END $$;
;

-- ---------- 0013_pending_order_guard_and_fill.sql ----------
SET search_path TO public, extensions;
CREATE OR REPLACE FUNCTION public.guard_trade_order_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user <> 'authenticated' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.order_type NOT IN ('limit','stop') OR NEW.trigger_price IS NULL OR NEW.trigger_price <= 0 OR NEW.amount <= 0 THEN
      RAISE EXCEPTION 'Invalid pending order';
    END IF;
    NEW.status := 'pending'; NEW.filled_at := NULL; NEW.filled_trade_id := NULL; NEW.cancel_reason := NULL;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'pending' OR NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Only pending orders can be cancelled';
  END IF;
  NEW := OLD;
  NEW.status := 'cancelled'; NEW.cancel_reason := 'Cancelled by you'; NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_trade_orders ON public.trade_orders;
CREATE TRIGGER trg_guard_trade_orders BEFORE INSERT OR UPDATE ON public.trade_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_trade_order_changes();

CREATE OR REPLACE FUNCTION public.fill_pending_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o RECORD; v_id uuid; n int := 0;
BEGIN
  UPDATE trade_orders SET status = 'expired', cancel_reason = 'Expired'
  WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= now();

  FOR o IN
    SELECT tor.*, a.price AS mkt FROM trade_orders tor JOIN assets a ON a.id = tor.asset_id
    WHERE tor.status = 'pending' AND a.price > 0 AND is_market_open(a.symbol, a.category, now()) AND (
      (tor.order_type = 'limit' AND upper(tor.trade_type) = 'BUY'  AND a.price <= tor.trigger_price) OR
      (tor.order_type = 'limit' AND upper(tor.trade_type) = 'SELL' AND a.price >= tor.trigger_price) OR
      (tor.order_type = 'stop'  AND upper(tor.trade_type) = 'BUY'  AND a.price >= tor.trigger_price) OR
      (tor.order_type = 'stop'  AND upper(tor.trade_type) = 'SELL' AND a.price <= tor.trigger_price))
    FOR UPDATE OF tor SKIP LOCKED
  LOOP
    BEGIN
      INSERT INTO trades (user_id, asset_id, symbol, trade_type, amount, leverage, open_price, status, trade_source,
                          stop_loss_price, take_profit_price, parent_order_id)
      VALUES (o.user_id, o.asset_id, o.symbol, upper(o.trade_type), o.amount, o.leverage, o.mkt, 'open', 'user',
              o.stop_loss_price, o.take_profit_price, o.id)
      RETURNING id INTO v_id;
      UPDATE trade_orders SET status = 'filled', filled_at = now(), filled_trade_id = v_id WHERE id = o.id;
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE trade_orders SET status = 'cancelled', cancel_reason = left(SQLERRM, 200) WHERE id = o.id;
    END;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.fill_pending_orders() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.process_price_triggers()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  t RECORD; u RECORD; s RECORD;
  v_sltp integer := 0; v_stopouts integer := 0; v_filled integer := 0;
  v_equity numeric; v_used numeric; v_level numeric; v_worst uuid;
BEGIN
  v_filled := fill_pending_orders();

  FOR t IN
    SELECT tr.id FROM trades tr JOIN assets a ON a.id = tr.asset_id
    WHERE tr.status = 'open' AND a.price > 0 AND (
      (upper(tr.trade_type) = 'BUY'  AND ((tr.stop_loss_price > 0 AND a.price <= tr.stop_loss_price) OR (tr.take_profit_price > 0 AND a.price >= tr.take_profit_price))) OR
      (upper(tr.trade_type) = 'SELL' AND ((tr.stop_loss_price > 0 AND a.price >= tr.stop_loss_price) OR (tr.take_profit_price > 0 AND a.price <= tr.take_profit_price)))
    )
  LOOP
    PERFORM close_trade_with_pnl(t.id, NULL);
    v_sltp := v_sltp + 1;
  END LOOP;

  UPDATE trades tr SET current_price = a.price,
    pnl = round(calc_trade_pnl(tr.trade_type, tr.amount, a.contract_size, tr.open_price, a.price), 2)
  FROM assets a WHERE a.id = tr.asset_id AND tr.status = 'open' AND a.price > 0;

  FOR u IN
    SELECT p.user_id, p.admin_id, p.grace_period_until
    FROM user_profiles p WHERE EXISTS (SELECT 1 FROM trades x WHERE x.user_id = p.user_id AND x.status = 'open')
  LOOP
    SELECT * INTO s FROM get_risk_settings(u.admin_id);
    LOOP
      SELECT COALESCE(sum(pnl), 0), COALESCE(sum(margin_used), 0) INTO v_equity, v_used
      FROM trades WHERE user_id = u.user_id AND status = 'open';
      v_equity := (SELECT balance FROM user_profiles WHERE user_id = u.user_id) + v_equity;
      EXIT WHEN v_used <= 0;
      v_level := v_equity / v_used * 100;
      IF v_level > s.mc THEN
        UPDATE user_profiles SET account_status = 'active', grace_period_until = NULL, equity = v_equity WHERE user_id = u.user_id;
        EXIT;
      ELSIF v_level > s.so THEN
        UPDATE user_profiles SET account_status = 'margin_call', equity = v_equity WHERE user_id = u.user_id;
        EXIT;
      END IF;
      IF s.gh > 0 AND (u.grace_period_until IS NULL OR u.grace_period_until > now()) THEN
        UPDATE user_profiles SET account_status = 'grace', equity = v_equity,
          grace_period_until = COALESCE(grace_period_until, now() + make_interval(hours => s.gh))
        WHERE user_id = u.user_id;
        EXIT;
      END IF;
      EXIT WHEN NOT s.ac;
      SELECT id INTO v_worst FROM trades WHERE user_id = u.user_id AND status = 'open' ORDER BY pnl ASC LIMIT 1;
      EXIT WHEN v_worst IS NULL;
      PERFORM close_trade_with_pnl(v_worst, NULL);
      v_stopouts := v_stopouts + 1;
      UPDATE user_profiles SET account_status = 'stopped_out', grace_period_until = NULL WHERE user_id = u.user_id;
    END LOOP;
    IF NOT s.neg THEN
      UPDATE user_profiles SET balance = 0, equity = 0, available_margin = 0
      WHERE user_id = u.user_id AND balance < 0
        AND NOT EXISTS (SELECT 1 FROM trades x WHERE x.user_id = u.user_id AND x.status = 'open');
    END IF;
  END LOOP;
  RETURN jsonb_build_object('sltp_closed', v_sltp, 'stopout_closed', v_stopouts, 'orders_filled', v_filled);
END;
$function$;
;

-- ---------- 0014_fix_closed_market_check.sql ----------
SET search_path TO public, extensions;
CREATE OR REPLACE FUNCTION public.enforce_trade_open_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_market numeric; v_contract numeric; v_available numeric; v_cat text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'open' THEN RETURN NEW; END IF;
  SELECT price, COALESCE(NULLIF(contract_size, 0), 1), category INTO v_market, v_contract, v_cat FROM assets WHERE id = NEW.asset_id;
  IF NEW.parent_order_id IS NULL
     AND NOT is_market_open(NEW.symbol, v_cat, now())
     AND NOT (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))) THEN
    RAISE EXCEPTION 'Market closed. You can place a pending order instead.';
  END IF;
  IF v_market > 0 AND (NEW.open_price IS NULL OR NEW.open_price <= 0 OR abs(NEW.open_price - v_market) / v_market > 0.0025) THEN
    NEW.open_price := v_market;
  END IF;
  NEW.current_price := NEW.open_price;
  NEW.margin_used := round(NEW.amount * v_contract * NEW.open_price / GREATEST(COALESCE(NEW.leverage, 1), 1), 2);
  SELECT available_margin INTO v_available FROM user_profiles WHERE user_id = NEW.user_id;
  IF v_available IS NULL OR v_available < NEW.margin_used THEN
    RAISE EXCEPTION 'Insufficient margin. Required: %, available: %', NEW.margin_used, COALESCE(v_available, 0);
  END IF;
  RETURN NEW;
END;
$function$;
;

-- ---------- 0015_credit_core.sql ----------
SET search_path TO public, extensions;
-- =====================================================================
-- CREDIT: company money a client can trade with but never withdraw
-- =====================================================================

-- 1. Credit pot on the account ---------------------------------------
ALTER TABLE public.user_profiles ADD COLUMN credit numeric NOT NULL DEFAULT 0;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_credit_nonnegative CHECK (credit >= 0);

-- 2. Ledger of every credit movement ----------------------------------
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'credit_in', 'credit_out', 'loss_cover', 'loss_cover_reversal',
    'negative_balance_reset', 'negative_balance_reset_reversal', 'account_reset')),
  amount numeric NOT NULL DEFAULT 0,          -- signed change in credit
  balance_change numeric NOT NULL DEFAULT 0,  -- signed change in balance booked by this entry
  credit_after numeric NOT NULL,
  balance_after numeric NOT NULL,
  reason text,
  performed_by uuid,                          -- admin who did it; NULL = automatic
  trade_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_transactions_user_created ON public.credit_transactions (user_id, created_at DESC);

GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users and their admins can view credit history"
ON public.credit_transactions FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.admin_user_relationships r
    WHERE r.admin_id = auth.uid() AND r.user_id = credit_transactions.user_id)
);
-- No insert/update/delete policies: only trusted database functions write the ledger.

-- 3. Live totals of a client's open positions --------------------------
CREATE OR REPLACE FUNCTION public.account_open_totals(_user_id uuid)
RETURNS TABLE(used numeric, floating numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(sum(t.margin_used), 0),
         COALESCE(sum(CASE WHEN a.price > 0
                           THEN round(calc_trade_pnl(t.trade_type, t.amount, a.contract_size, t.open_price, a.price), 2)
                           ELSE COALESCE(t.pnl, 0) END), 0)
  FROM trades t JOIN assets a ON a.id = t.asset_id
  WHERE t.user_id = _user_id AND t.status = 'open';
$$;
REVOKE ALL ON FUNCTION public.account_open_totals(uuid) FROM PUBLIC, anon, authenticated;

-- 4. One place that derives equity / margin figures --------------------
--    equity = balance + credit + open P&L ; free margin = equity - margin in use
CREATE OR REPLACE FUNCTION public.validate_user_balance()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE o RECORD;
BEGIN
  NEW.balance := COALESCE(NEW.balance, 0);
  NEW.credit := COALESCE(NEW.credit, 0);
  IF NEW.credit < 0 THEN
    RAISE EXCEPTION 'Credit cannot be negative';
  END IF;
  SELECT * INTO o FROM account_open_totals(NEW.user_id);
  NEW.used_margin := o.used;
  NEW.equity := NEW.balance + NEW.credit + o.floating;
  NEW.available_margin := GREATEST(NEW.equity - NEW.used_margin, 0);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_user_balance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS check_margin_before_update ON public.user_profiles;
DROP TRIGGER IF EXISTS final_balance_validation_trigger ON public.user_profiles;
DROP FUNCTION IF EXISTS public.prevent_negative_margin();

-- 5. Signed-in people can never write money fields directly -------------
CREATE OR REPLACE FUNCTION public.prevent_user_financial_updates()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_admin boolean;
BEGIN
  -- Only direct edits made through the API as a signed-in person are restricted.
  -- Trusted database functions run as the function owner and pass through.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  v_admin := public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role);
  IF TG_OP = 'INSERT' THEN
    NEW.balance := 0; NEW.credit := 0; NEW.equity := 0; NEW.used_margin := 0; NEW.available_margin := 0;
    NEW.account_status := 'active'; NEW.grace_period_until := NULL; NEW.frozen_at := NULL; NEW.frozen_reason := NULL;
    IF NOT v_admin THEN
      NEW.admin_id := NULL; NEW.promo_code_used := NULL; NEW.assignment_method := 'manual';
    END IF;
    RETURN NEW;
  END IF;
  -- Credit only changes through the credit functions, so the ledger is always complete
  NEW.credit := OLD.credit;
  IF auth.uid() = NEW.user_id AND NOT v_admin THEN
    NEW.balance := OLD.balance;
    NEW.equity := OLD.equity;
    NEW.used_margin := OLD.used_margin;
    NEW.available_margin := OLD.available_margin;
    NEW.admin_id := OLD.admin_id;
    NEW.promo_code_used := OLD.promo_code_used;
    NEW.assignment_method := OLD.assignment_method;
    NEW.assigned_at := OLD.assigned_at;
    NEW.account_status := OLD.account_status;
    NEW.grace_period_until := OLD.grace_period_until;
    NEW.frozen_at := OLD.frozen_at;
    NEW.frozen_reason := OLD.frozen_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_user_financial_inserts_trigger ON public.user_profiles;
CREATE TRIGGER prevent_user_financial_inserts_trigger
BEFORE INSERT ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_user_financial_updates();

-- 6. The flat-account rule ---------------------------------------------
--    Credit covers a negative balance only when no position is open; what is
--    left after that follows the admin's negative-balance setting.
CREATE OR REPLACE FUNCTION public.settle_account(_user_id uuid, _trade_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p RECORD;
  v_cover numeric := 0;
  v_reset numeric := 0;
  v_neg boolean;
  v_flat boolean;
BEGIN
  SELECT * INTO p FROM user_profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('credit_used', 0, 'negative_balance_cleared', 0);
  END IF;
  v_flat := NOT EXISTS (SELECT 1 FROM trades WHERE user_id = _user_id AND status = 'open');

  IF v_flat AND p.balance < 0 THEN
    IF p.credit > 0 THEN
      v_cover := LEAST(p.credit, -p.balance);
      INSERT INTO credit_transactions (user_id, type, amount, balance_change, credit_after, balance_after, reason, trade_id)
      VALUES (_user_id, 'loss_cover', -v_cover, v_cover, p.credit - v_cover, p.balance + v_cover,
              'Credit used to cover trading losses', _trade_id);
    END IF;
    IF p.balance + v_cover < 0 THEN
      SELECT neg INTO v_neg FROM get_risk_settings(p.admin_id);
      IF NOT COALESCE(v_neg, false) THEN
        v_reset := -(p.balance + v_cover);
        INSERT INTO credit_transactions (user_id, type, amount, balance_change, credit_after, balance_after, reason, trade_id)
        VALUES (_user_id, 'negative_balance_reset', 0, v_reset, p.credit - v_cover, 0,
                'Negative balance cleared', _trade_id);
      END IF;
    END IF;
  END IF;

  UPDATE user_profiles SET
    balance = p.balance + v_cover + v_reset,
    credit = p.credit - v_cover,
    account_status = CASE WHEN v_flat AND account_status IN ('margin_call', 'grace') THEN 'active' ELSE account_status END,
    grace_period_until = CASE WHEN v_flat THEN NULL ELSE grace_period_until END,
    updated_at = now()
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('credit_used', v_cover, 'negative_balance_cleared', v_reset);
END;
$$;
REVOKE ALL ON FUNCTION public.settle_account(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 7. What a client may withdraw ------------------------------------------
--    balance - margin in use - open losses; credit never counts
CREATE OR REPLACE FUNCTION public.get_withdrawable_amount(_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_bal numeric; o RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT has_role(auth.uid(), 'super_admin'::app_role)
     AND NOT EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = auth.uid() AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT balance INTO v_bal FROM user_profiles WHERE user_id = _user_id;
  IF v_bal IS NULL THEN
    RETURN 0;
  END IF;
  SELECT * INTO o FROM account_open_totals(_user_id);
  RETURN GREATEST(trunc(LEAST(v_bal, v_bal - o.used + LEAST(o.floating, 0)), 2), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.get_withdrawable_amount(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_withdrawable_amount(uuid) TO authenticated, service_role;
;

-- ---------- 0016_credit_trading_rules.sql ----------
SET search_path TO public, extensions;
-- 8. Trades: what a signed-in client may write directly -----------------
CREATE OR REPLACE FUNCTION public.guard_trade_changes()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_sl numeric; v_tp numeric;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- A client can only open a fresh market position; everything else is decided by the server
    NEW.status := 'open';
    NEW.pnl := 0;
    NEW.close_price := NULL;
    NEW.closed_at := NULL;
    NEW.opened_at := now();
    NEW.created_at := now();
    NEW.updated_at := now();
    NEW.trade_source := 'user';
    NEW.parent_order_id := NULL;
    NEW.version := 0;
    RETURN NEW;
  END IF;
  -- UPDATE: only stop-loss / take-profit of an open position
  IF OLD.status <> 'open' THEN
    RAISE EXCEPTION 'Closed trades cannot be changed';
  END IF;
  v_sl := NEW.stop_loss_price;
  v_tp := NEW.take_profit_price;
  NEW := OLD;
  NEW.stop_loss_price := v_sl;
  NEW.take_profit_price := v_tp;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_trade_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_a_guard_trade_changes ON public.trades;
CREATE TRIGGER trg_a_guard_trade_changes
BEFORE INSERT OR UPDATE ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.guard_trade_changes();

-- 9. Opening a position: server price, server margin, real free margin ---
CREATE OR REPLACE FUNCTION public.enforce_trade_open_rules()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_market numeric; v_contract numeric; v_cat text; v_min numeric; v_maxlev integer;
  v_bal numeric; v_credit numeric; v_free numeric; o RECORD;
BEGIN
  IF NEW.status IS DISTINCT FROM 'open' THEN RETURN NEW; END IF;

  SELECT price, COALESCE(NULLIF(contract_size, 0), 1), category, COALESCE(min_trade_size, 0), GREATEST(COALESCE(max_leverage, 100), 100)
    INTO v_market, v_contract, v_cat, v_min, v_maxlev
  FROM assets WHERE id = NEW.asset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Market not found';
  END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 OR NEW.amount < v_min THEN
    RAISE EXCEPTION 'Minimum trade size is %', v_min;
  END IF;
  IF NEW.leverage IS NULL OR NEW.leverage < 1 OR NEW.leverage > v_maxlev THEN
    RAISE EXCEPTION 'Leverage must be between 1 and %', v_maxlev;
  END IF;
  IF v_market IS NULL OR v_market <= 0 THEN
    RAISE EXCEPTION 'No price available for this market yet';
  END IF;

  IF NEW.parent_order_id IS NULL
     AND NOT is_market_open(NEW.symbol, v_cat, now())
     AND NOT (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))) THEN
    RAISE EXCEPTION 'Market closed. You can place a pending order instead.';
  END IF;

  -- Server price is the authority: a client price is only accepted within 0.25% of the market
  IF NEW.open_price IS NULL OR NEW.open_price <= 0 OR abs(NEW.open_price - v_market) / v_market > 0.0025 THEN
    NEW.open_price := v_market;
  END IF;
  NEW.current_price := NEW.open_price;
  NEW.pnl := 0;
  NEW.margin_used := GREATEST(round(NEW.amount * v_contract * NEW.open_price / NEW.leverage, 2), 0.01);

  -- Lock the account so two orders sent at once cannot both spend the same free margin
  SELECT balance, credit INTO v_bal, v_credit FROM user_profiles WHERE user_id = NEW.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  SELECT * INTO o FROM account_open_totals(NEW.user_id);
  -- free margin = balance + credit + open P&L - margin in use
  v_free := v_bal + v_credit + o.floating - o.used;
  IF v_free < NEW.margin_used THEN
    RAISE EXCEPTION 'Insufficient margin. Required: %, available: %', NEW.margin_used, round(GREATEST(v_free, 0), 2);
  END IF;
  RETURN NEW;
END;
$$;

-- 10. Keep the account figures in step with its trades -------------------
CREATE OR REPLACE FUNCTION public.handle_trade_opened()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'open' THEN
    UPDATE user_profiles SET updated_at = now() WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_trade_closed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status OR OLD.margin_used IS DISTINCT FROM NEW.margin_used THEN
    UPDATE user_profiles SET updated_at = now() WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_trade_deleted()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE user_profiles SET updated_at = now() WHERE user_id = OLD.user_id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_trade_deleted() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_handle_trade_deleted ON public.trades;
CREATE TRIGGER tr_handle_trade_deleted
AFTER DELETE ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.handle_trade_deleted();

-- 11. Closing a position --------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_trade_with_pnl(p_trade_id uuid, p_close_price numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trade RECORD;
  v_market numeric;
  v_contract numeric;
  v_price numeric;
  v_pnl numeric;
  v_balance numeric;
  v_credit numeric;
  v_settle jsonb;
  v_staff boolean := false;
BEGIN
  SELECT * INTO v_trade FROM trades WHERE id = p_trade_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Trade not found or already closed');
  END IF;
  IF auth.uid() IS NOT NULL AND v_trade.user_id IS DISTINCT FROM auth.uid() THEN
    v_staff := has_role(auth.uid(), 'super_admin'::app_role)
            OR EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = auth.uid() AND user_id = v_trade.user_id);
    IF NOT v_staff THEN
      RETURN jsonb_build_object('error', 'Access denied');
    END IF;
  END IF;

  SELECT price, contract_size INTO v_market, v_contract FROM assets WHERE id = v_trade.asset_id;
  -- Server price is the authority: a client price is only accepted within 0.25% of the market
  IF v_market IS NULL OR v_market <= 0 THEN
    IF v_staff AND p_close_price > 0 THEN
      v_price := p_close_price;
    ELSE
      RETURN jsonb_build_object('error', 'No price available to close this trade');
    END IF;
  ELSIF p_close_price IS NULL OR p_close_price <= 0 OR abs(p_close_price - v_market) / v_market > 0.0025 THEN
    v_price := v_market;
  ELSE
    v_price := p_close_price;
  END IF;

  v_pnl := round(calc_trade_pnl(v_trade.trade_type, v_trade.amount, v_contract, v_trade.open_price, v_price), 2);

  UPDATE trades SET status = 'closed', close_price = v_price, current_price = v_price, pnl = v_pnl,
    closed_at = now(), updated_at = now(), version = COALESCE(version, 0) + 1
  WHERE id = p_trade_id;

  -- Realised profit or loss always goes to the balance (own money)
  UPDATE user_profiles SET balance = balance + v_pnl, updated_at = now() WHERE user_id = v_trade.user_id;
  -- If the account is now flat with a negative balance, credit covers it
  v_settle := settle_account(v_trade.user_id, p_trade_id);

  SELECT balance, credit INTO v_balance, v_credit FROM user_profiles WHERE user_id = v_trade.user_id;

  RETURN jsonb_build_object('success', true, 'pnl', v_pnl, 'close_price', v_price,
    'new_balance', v_balance, 'new_credit', v_credit,
    'credit_used', v_settle->'credit_used', 'negative_balance_cleared', v_settle->'negative_balance_cleared');
END;
$$;

-- 12. Price run: SL/TP, margin call, grace, stop-out (equity includes credit)
CREATE OR REPLACE FUNCTION public.process_price_triggers()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t RECORD; u RECORD; s RECORD;
  v_sltp integer := 0; v_stopouts integer := 0; v_filled integer := 0;
  v_float numeric; v_equity numeric; v_used numeric; v_level numeric; v_worst uuid; v_res jsonb;
BEGIN
  v_filled := fill_pending_orders();

  FOR t IN
    SELECT tr.id FROM trades tr JOIN assets a ON a.id = tr.asset_id
    WHERE tr.status = 'open' AND a.price > 0 AND (
      (upper(tr.trade_type) = 'BUY'  AND ((tr.stop_loss_price > 0 AND a.price <= tr.stop_loss_price) OR (tr.take_profit_price > 0 AND a.price >= tr.take_profit_price))) OR
      (upper(tr.trade_type) = 'SELL' AND ((tr.stop_loss_price > 0 AND a.price >= tr.stop_loss_price) OR (tr.take_profit_price > 0 AND a.price <= tr.take_profit_price)))
    )
  LOOP
    v_res := close_trade_with_pnl(t.id, NULL);
    IF v_res ? 'success' THEN v_sltp := v_sltp + 1; END IF;
  END LOOP;

  UPDATE trades tr SET current_price = a.price,
    pnl = round(calc_trade_pnl(tr.trade_type, tr.amount, a.contract_size, tr.open_price, a.price), 2)
  FROM assets a WHERE a.id = tr.asset_id AND tr.status = 'open' AND a.price > 0;

  FOR u IN
    SELECT p.user_id, p.admin_id, p.grace_period_until
    FROM user_profiles p WHERE EXISTS (SELECT 1 FROM trades x WHERE x.user_id = p.user_id AND x.status = 'open')
  LOOP
    SELECT * INTO s FROM get_risk_settings(u.admin_id);
    LOOP
      SELECT COALESCE(sum(pnl), 0), COALESCE(sum(margin_used), 0) INTO v_float, v_used
      FROM trades WHERE user_id = u.user_id AND status = 'open';
      EXIT WHEN v_used <= 0;
      -- equity = balance + credit + open P&L
      SELECT balance + credit + v_float INTO v_equity FROM user_profiles WHERE user_id = u.user_id;
      v_level := v_equity / v_used * 100;
      IF v_level > s.mc THEN
        UPDATE user_profiles SET account_status = 'active', grace_period_until = NULL WHERE user_id = u.user_id;
        EXIT;
      ELSIF v_level > s.so THEN
        UPDATE user_profiles SET account_status = 'margin_call' WHERE user_id = u.user_id;
        EXIT;
      END IF;
      IF s.gh > 0 AND (u.grace_period_until IS NULL OR u.grace_period_until > now()) THEN
        UPDATE user_profiles SET account_status = 'grace',
          grace_period_until = COALESCE(grace_period_until, now() + make_interval(hours => s.gh))
        WHERE user_id = u.user_id;
        EXIT;
      END IF;
      IF NOT s.ac THEN
        UPDATE user_profiles SET account_status = 'margin_call' WHERE user_id = u.user_id;
        EXIT;
      END IF;
      SELECT id INTO v_worst FROM trades WHERE user_id = u.user_id AND status = 'open' ORDER BY pnl ASC LIMIT 1;
      EXIT WHEN v_worst IS NULL;
      v_res := close_trade_with_pnl(v_worst, NULL);
      EXIT WHEN NOT (v_res ? 'success');
      v_stopouts := v_stopouts + 1;
      UPDATE user_profiles SET account_status = 'stopped_out', grace_period_until = NULL WHERE user_id = u.user_id;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('sltp_closed', v_sltp, 'stopout_closed', v_stopouts, 'orders_filled', v_filled);
END;
$$;
;

-- ---------- 0017_credit_admin_tools.sql ----------
SET search_path TO public, extensions;
-- Ledger entries written inside one operation keep their real order
ALTER TABLE public.credit_transactions ALTER COLUMN created_at SET DEFAULT clock_timestamp();

-- Money on an account only ever changes through the trusted functions, for everyone
CREATE OR REPLACE FUNCTION public.prevent_user_financial_updates()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_admin boolean;
BEGIN
  -- Only direct edits made through the API as a signed-in person are restricted.
  -- Trusted database functions run as the function owner and pass through.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  v_admin := public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role);
  IF TG_OP = 'INSERT' THEN
    NEW.balance := 0; NEW.credit := 0; NEW.equity := 0; NEW.used_margin := 0; NEW.available_margin := 0;
    NEW.account_status := 'active'; NEW.grace_period_until := NULL; NEW.frozen_at := NULL; NEW.frozen_reason := NULL;
    IF NOT v_admin THEN
      NEW.admin_id := NULL; NEW.promo_code_used := NULL; NEW.assignment_method := 'manual';
    END IF;
    RETURN NEW;
  END IF;
  -- Balance and credit never change by a direct edit, not even by staff: the
  -- balance and credit functions keep the history complete.
  NEW.balance := OLD.balance;
  NEW.credit := OLD.credit;
  IF auth.uid() = NEW.user_id AND NOT v_admin THEN
    NEW.equity := OLD.equity;
    NEW.used_margin := OLD.used_margin;
    NEW.available_margin := OLD.available_margin;
    NEW.admin_id := OLD.admin_id;
    NEW.promo_code_used := OLD.promo_code_used;
    NEW.assignment_method := OLD.assignment_method;
    NEW.assigned_at := OLD.assigned_at;
    NEW.account_status := OLD.account_status;
    NEW.grace_period_until := OLD.grace_period_until;
    NEW.frozen_at := OLD.frozen_at;
    NEW.frozen_reason := OLD.frozen_reason;
  END IF;
  RETURN NEW;
END;
$$;

-- Staff tools apply to clients' trades; on their own trades staff follow the client rules
CREATE OR REPLACE FUNCTION public.guard_trade_changes()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_sl numeric; v_tp numeric;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM auth.uid()
     AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)) THEN
    IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'A trade cannot be moved to another account';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- A client can only open a fresh market position; everything else is decided by the server
    NEW.status := 'open';
    NEW.pnl := 0;
    NEW.close_price := NULL;
    NEW.closed_at := NULL;
    NEW.opened_at := now();
    NEW.created_at := now();
    NEW.updated_at := now();
    NEW.trade_source := 'user';
    NEW.parent_order_id := NULL;
    NEW.version := 0;
    RETURN NEW;
  END IF;
  -- UPDATE: only stop-loss / take-profit of an open position
  IF OLD.status <> 'open' THEN
    RAISE EXCEPTION 'Closed trades cannot be changed';
  END IF;
  v_sl := NEW.stop_loss_price;
  v_tp := NEW.take_profit_price;
  NEW := OLD;
  NEW.stop_loss_price := v_sl;
  NEW.take_profit_price := v_tp;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_trade_changes() FROM PUBLIC, anon, authenticated;

-- Withdrawable money: balance - margin in use - open losses. Credit never counts.
CREATE OR REPLACE FUNCTION public.account_withdrawable(_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_bal numeric; o RECORD;
BEGIN
  SELECT balance INTO v_bal FROM user_profiles WHERE user_id = _user_id;
  IF v_bal IS NULL THEN
    RETURN 0;
  END IF;
  SELECT * INTO o FROM account_open_totals(_user_id);
  RETURN GREATEST(trunc(LEAST(v_bal, v_bal - o.used + LEAST(o.floating, 0)), 2), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.account_withdrawable(uuid) FROM PUBLIC, anon, authenticated;

-- What a client can still request: withdrawable money minus requests already waiting
CREATE OR REPLACE FUNCTION public.get_withdrawable_amount(_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pending numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT has_role(auth.uid(), 'super_admin'::app_role)
     AND NOT EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = auth.uid() AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT COALESCE(sum(amount), 0) INTO v_pending FROM withdrawal_requests WHERE user_id = _user_id AND status = 'pending';
  RETURN GREATEST(account_withdrawable(_user_id) - v_pending, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.get_withdrawable_amount(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_withdrawable_amount(uuid) TO authenticated, service_role;

-- 13. Admin: add / remove / set credit ------------------------------------
CREATE OR REPLACE FUNCTION public.admin_modify_user_credit(
  _admin_id uuid, _user_id uuid, _amount numeric, _operation text,
  _reason text DEFAULT NULL, _force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p RECORD; o RECORD; s RECORD;
  v_amt numeric; v_new numeric; v_delta numeric; v_level numeric; v_final_credit numeric; v_final_balance numeric;
  v_reason text := NULLIF(trim(COALESCE(_reason, '')), '');
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  IF NOT (has_role(_admin_id, 'super_admin'::app_role)
          OR (has_role(_admin_id, 'admin'::app_role)
              AND EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = _admin_id AND user_id = _user_id))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  IF _operation NOT IN ('add', 'remove', 'set') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid operation');
  END IF;
  v_amt := round(_amount, 2);
  IF v_amt IS NULL OR v_amt < 0 OR v_amt > 1000000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter a valid amount');
  END IF;
  IF _operation IN ('add', 'remove') AND v_amt = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT * INTO p FROM user_profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF _operation = 'add' THEN
    v_new := p.credit + v_amt;
  ELSIF _operation = 'remove' THEN
    IF v_amt > p.credit THEN
      RETURN jsonb_build_object('success', false, 'code', 'not_enough_credit',
        'error', format('This client only has $%s credit', to_char(p.credit, 'FM999,999,999,990.00')));
    END IF;
    v_new := p.credit - v_amt;
  ELSE
    v_new := v_amt;
  END IF;
  v_delta := v_new - p.credit;
  IF v_delta = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'no_change',
      'error', format('Credit is already $%s', to_char(p.credit, 'FM999,999,999,990.00')));
  END IF;
  IF v_new > 1000000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credit limit exceeded');
  END IF;

  -- Taking credit away under open positions can trigger a margin call or stop-out
  IF v_delta < 0 THEN
    SELECT * INTO o FROM account_open_totals(_user_id);
    IF o.used > 0 THEN
      SELECT * INTO s FROM get_risk_settings(p.admin_id);
      v_level := (p.balance + v_new + o.floating) / o.used * 100;
      IF v_level <= s.mc AND NOT COALESCE(_force, false) THEN
        RETURN jsonb_build_object('success', false, 'code', 'margin_risk',
          'error', format('Removing this credit would drop the margin level to %s%%. Margin call is at %s%% and stop-out at %s%%, so open trades may be closed automatically.',
                          round(v_level), s.mc, s.so),
          'margin_level_after', round(v_level, 2), 'margin_call_level', s.mc, 'stop_out_level', s.so);
      END IF;
    END IF;
  END IF;

  UPDATE user_profiles SET credit = v_new, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO credit_transactions (user_id, type, amount, balance_change, credit_after, balance_after, reason, performed_by)
  VALUES (_user_id, CASE WHEN v_delta > 0 THEN 'credit_in' ELSE 'credit_out' END, v_delta, 0, v_new, p.balance,
          COALESCE(v_reason, CASE WHEN v_delta > 0 THEN 'Credit added' ELSE 'Credit removed' END), _admin_id);

  -- A flat account that owes money is covered by the new credit straight away
  PERFORM settle_account(_user_id, NULL);
  SELECT credit, balance INTO v_final_credit, v_final_balance FROM user_profiles WHERE user_id = _user_id;

  INSERT INTO admin_audit_log (admin_id, user_id, action, old_value, new_value, reason, action_details)
  VALUES (_admin_id, _user_id, 'credit_' || _operation,
          jsonb_build_object('credit', p.credit, 'balance', p.balance),
          jsonb_build_object('credit', v_final_credit, 'balance', v_final_balance),
          v_reason,
          jsonb_build_object('operation', _operation, 'amount', v_amt, 'change', v_delta, 'forced', COALESCE(_force, false)));

  RETURN jsonb_build_object('success', true,
    'message', CASE WHEN v_delta > 0 THEN 'Credit added' ELSE 'Credit removed' END,
    'previous_credit', p.credit, 'new_credit', v_final_credit, 'change', v_delta, 'new_balance', v_final_balance);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_modify_user_credit(uuid, uuid, numeric, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_modify_user_credit(uuid, uuid, numeric, text, text, boolean) TO authenticated, service_role;

-- 14. Admin: balance changes (records what really moved) -------------------
CREATE OR REPLACE FUNCTION public.admin_modify_user_balance(_admin_id uuid, _user_id uuid, _amount numeric, _operation text, _reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p RECORD;
  v_amt numeric; v_new numeric; v_delta numeric;
  _deposit_id uuid; _withdrawal_id uuid;
  v_reason text := NULLIF(trim(COALESCE(_reason, '')), '');
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = _admin_id AND user_id = _user_id)
     AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  IF _operation NOT IN ('add', 'deduct', 'set') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid operation');
  END IF;
  v_amt := round(_amount, 2);
  IF v_amt IS NULL OR v_amt < 0 OR v_amt > 1000000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter a valid amount');
  END IF;
  IF _operation IN ('add', 'deduct') AND v_amt = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT * INTO p FROM user_profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF _operation = 'set' THEN
    v_new := v_amt;
  ELSIF _operation = 'add' THEN
    v_new := p.balance + v_amt;
  ELSE
    -- never deduct more than the client actually has
    v_new := p.balance - LEAST(v_amt, GREATEST(p.balance, 0));
  END IF;
  v_delta := v_new - p.balance;
  IF v_delta = 0 THEN
    RETURN jsonb_build_object('success', false, 'error',
      CASE WHEN _operation = 'deduct' THEN 'There is no balance to deduct' ELSE 'Balance is already that amount' END);
  END IF;

  UPDATE user_profiles SET balance = v_new, updated_at = now() WHERE user_id = _user_id;

  IF v_delta > 0 THEN
    INSERT INTO deposit_requests (user_id, amount, status, deposit_type, processed_by_admin, processed_at, admin_notes)
    VALUES (_user_id, v_delta, 'approved', 'admin_adjustment', _admin_id, now(),
            COALESCE(v_reason, CASE WHEN _operation = 'set' THEN format('Balance set from %s to %s by admin', p.balance, v_new) ELSE 'Balance added by admin' END))
    RETURNING id INTO _deposit_id;
  ELSE
    INSERT INTO withdrawal_requests (user_id, amount, status, withdrawal_type, processed_by_admin, processed_at, admin_notes)
    VALUES (_user_id, -v_delta, 'approved', 'admin_adjustment', _admin_id, now(),
            COALESCE(v_reason, CASE WHEN _operation = 'set' THEN format('Balance set from %s to %s by admin', p.balance, v_new) ELSE 'Balance deducted by admin' END))
    RETURNING id INTO _withdrawal_id;
  END IF;

  PERFORM settle_account(_user_id, NULL);
  SELECT balance INTO v_new FROM user_profiles WHERE user_id = _user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE WHEN _operation = 'deduct' AND -v_delta < v_amt
                    THEN format('Only $%s was available and has been deducted', to_char(-v_delta, 'FM999,999,999,990.00'))
                    ELSE format('Balance %s successfully', _operation) END,
    'previous_balance', p.balance,
    'new_balance', v_new,
    'created_deposit_id', _deposit_id,
    'created_withdrawal_id', _withdrawal_id
  );
END;
$$;

-- 15. Admin: reset an account (credit goes back to zero too) ---------------
CREATE OR REPLACE FUNCTION public.admin_reset_account(_admin_id uuid, _user_id uuid, _close_trades boolean DEFAULT true, _clear_history boolean DEFAULT false, _reset_balance boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _trades_closed INTEGER := 0;
  _trades_deleted INTEGER := 0;
  _previous_balance NUMERIC;
  _previous_credit NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = _admin_id AND user_id = _user_id)
     AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  IF _close_trades THEN
    UPDATE trades
    SET status = 'closed', close_price = open_price, pnl = 0, closed_at = NOW(), updated_at = NOW()
    WHERE user_id = _user_id AND status = 'open';
    GET DIAGNOSTICS _trades_closed = ROW_COUNT;
    UPDATE trade_orders SET status = 'cancelled', cancel_reason = 'Account reset', updated_at = now()
    WHERE user_id = _user_id AND status = 'pending';
  END IF;
  IF _clear_history THEN
    DELETE FROM trades WHERE user_id = _user_id;
    GET DIAGNOSTICS _trades_deleted = ROW_COUNT;
  END IF;

  SELECT balance, credit INTO _previous_balance, _previous_credit FROM user_profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF _reset_balance THEN
    UPDATE user_profiles
    SET balance = 0, credit = 0, account_status = 'active', grace_period_until = NULL,
        frozen_at = NULL, frozen_reason = NULL, updated_at = NOW()
    WHERE user_id = _user_id;
    INSERT INTO credit_transactions (user_id, type, amount, balance_change, credit_after, balance_after, reason, performed_by)
    VALUES (_user_id, 'account_reset', -_previous_credit, -_previous_balance, 0, 0, 'Account reset by admin', _admin_id);
  ELSE
    PERFORM settle_account(_user_id, NULL);
  END IF;

  INSERT INTO admin_audit_log (admin_id, user_id, action, old_value, new_value, action_details)
  VALUES (
    _admin_id, _user_id, 'account_reset',
    jsonb_build_object('balance', _previous_balance, 'credit', _previous_credit),
    CASE WHEN _reset_balance THEN jsonb_build_object('balance', 0, 'credit', 0)
         ELSE jsonb_build_object('balance', _previous_balance, 'credit', _previous_credit) END,
    jsonb_build_object('close_trades', _close_trades, 'clear_history', _clear_history, 'reset_balance', _reset_balance,
                       'trades_closed', _trades_closed, 'trades_deleted', _trades_deleted)
  );
  RETURN jsonb_build_object('success', true, 'trades_closed', _trades_closed, 'trades_deleted', _trades_deleted,
                            'previous_balance', _previous_balance, 'previous_credit', _previous_credit);
END;
$$;

-- 16. Admin: delete a trade and undo its effect on the account -------------
CREATE OR REPLACE FUNCTION public.admin_delete_trade(_admin_id uuid, _trade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _trade RECORD; p RECORD;
  v_refund numeric := 0; v_reset_at timestamptz; v_since timestamptz;
  v_outstanding numeric; v_undo_reset numeric := 0; v_restore numeric := 0; v_to_balance numeric := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT * INTO _trade FROM trades WHERE id = _trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = _admin_id AND user_id = _trade.user_id)
     AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  SELECT * INTO p FROM user_profiles WHERE user_id = _trade.user_id FOR UPDATE;

  DELETE FROM trades WHERE id = _trade_id;

  IF _trade.status = 'closed' AND COALESCE(_trade.pnl, 0) <> 0 THEN
    v_refund := -_trade.pnl;  -- positive when the deleted trade was a loss
    IF v_refund > 0 THEN
      v_since := COALESCE(_trade.closed_at, _trade.updated_at);
      SELECT max(created_at) INTO v_reset_at FROM credit_transactions WHERE user_id = _trade.user_id AND type = 'account_reset';

      -- a) the company already wrote off part of this loss: cancel that first
      SELECT GREATEST(COALESCE(sum(balance_change), 0), 0) INTO v_outstanding
      FROM credit_transactions
      WHERE user_id = _trade.user_id AND type IN ('negative_balance_reset', 'negative_balance_reset_reversal')
        AND created_at >= v_since AND (v_reset_at IS NULL OR created_at > v_reset_at);
      v_undo_reset := LEAST(v_refund, v_outstanding);
      v_refund := v_refund - v_undo_reset;

      -- b) credit paid for part of this loss: give the credit back (not cash)
      SELECT GREATEST(COALESCE(-sum(amount), 0), 0) INTO v_outstanding
      FROM credit_transactions
      WHERE user_id = _trade.user_id AND type IN ('loss_cover', 'loss_cover_reversal')
        AND created_at >= v_since AND (v_reset_at IS NULL OR created_at > v_reset_at);
      v_restore := LEAST(v_refund, v_outstanding);
      v_refund := v_refund - v_restore;

      -- c) the rest was the client's own money
      v_to_balance := v_refund;
    ELSE
      v_to_balance := v_refund;  -- taking a profit back
    END IF;

    UPDATE user_profiles SET balance = balance + v_to_balance, credit = credit + v_restore, updated_at = now()
    WHERE user_id = _trade.user_id;
    IF v_undo_reset > 0 THEN
      INSERT INTO credit_transactions (user_id, type, amount, balance_change, credit_after, balance_after, reason, performed_by, trade_id)
      VALUES (_trade.user_id, 'negative_balance_reset_reversal', 0, -v_undo_reset, p.credit + v_restore, p.balance + v_to_balance,
              'Trade deleted by admin: earlier negative-balance clearing no longer needed', _admin_id, _trade_id);
    END IF;
    IF v_restore > 0 THEN
      INSERT INTO credit_transactions (user_id, type, amount, balance_change, credit_after, balance_after, reason, performed_by, trade_id)
      VALUES (_trade.user_id, 'loss_cover_reversal', v_restore, -v_restore, p.credit + v_restore, p.balance + v_to_balance,
              'Trade deleted by admin: credit that covered its loss was returned', _admin_id, _trade_id);
    END IF;
  END IF;

  PERFORM settle_account(_trade.user_id, NULL);

  INSERT INTO admin_audit_log (admin_id, user_id, action, old_value, action_details)
  VALUES (
    _admin_id, _trade.user_id, 'trade_deleted', row_to_json(_trade)::jsonb,
    jsonb_build_object('trade_id', _trade_id, 'was_open', _trade.status = 'open',
                       'balance_change', v_to_balance, 'credit_returned', v_restore, 'write_off_cancelled', v_undo_reset)
  );
  RETURN jsonb_build_object(
    'success', true,
    'trade_id', _trade_id,
    'was_open', _trade.status = 'open',
    'margin_released', CASE WHEN _trade.status = 'open' THEN _trade.margin_used ELSE 0 END,
    'pnl_reversed', CASE WHEN _trade.status = 'closed' THEN _trade.pnl ELSE 0 END,
    'balance_change', v_to_balance,
    'credit_returned', v_restore
  );
END;
$$;

-- 17. Admin: open a trade for a client (margin is checked by the trade rules)
CREATE OR REPLACE FUNCTION public.admin_create_trade(_admin_id uuid, _user_id uuid, _asset_id uuid, _symbol text, _trade_type text, _amount numeric, _leverage integer, _open_price numeric)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _asset_record RECORD;
  _trade_id UUID;
  _margin NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = _admin_id AND user_id = _user_id)
     AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied to this user');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = _user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  SELECT min_trade_size, max_leverage, is_active INTO _asset_record FROM assets WHERE id = _asset_id;
  IF _asset_record IS NULL OR NOT _asset_record.is_active THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or inactive asset');
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount < _asset_record.min_trade_size THEN
    RETURN json_build_object('success', false, 'error', 'Amount below minimum trade size');
  END IF;
  IF _leverage IS NULL OR _leverage < 1 OR _leverage > _asset_record.max_leverage THEN
    RETURN json_build_object('success', false, 'error', 'Leverage exceeds maximum allowed');
  END IF;
  IF _trade_type NOT IN ('BUY', 'SELL') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid trade type');
  END IF;
  INSERT INTO trades (user_id, asset_id, symbol, trade_type, amount, leverage, open_price, current_price, margin_used, status, trade_source)
  VALUES (_user_id, _asset_id, _symbol, _trade_type, _amount, _leverage, _open_price, _open_price, 0, 'open', 'bot')
  RETURNING id, margin_used INTO _trade_id, _margin;
  RETURN json_build_object('success', true, 'trade_id', _trade_id, 'margin_used', _margin, 'message', 'Bot trade created successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 17b. Admin: correct the open price of a client's open trade ---------------
CREATE OR REPLACE FUNCTION public.admin_modify_trade_open_price(_admin_id uuid, _trade_id uuid, _new_open_price numeric)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _trade RECORD; v_market numeric; v_contract numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF _new_open_price IS NULL OR _new_open_price <= 0 THEN
    RETURN false;
  END IF;
  SELECT * INTO _trade FROM trades WHERE id = _trade_id FOR UPDATE;
  IF NOT FOUND OR _trade.status <> 'open' THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = _admin_id AND user_id = _trade.user_id)
     AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN false;
  END IF;
  SELECT price, COALESCE(NULLIF(contract_size, 0), 1) INTO v_market, v_contract FROM assets WHERE id = _trade.asset_id;
  UPDATE trades
  SET open_price = _new_open_price,
      margin_used = GREATEST(round(amount * v_contract * _new_open_price / GREATEST(leverage, 1), 2), 0.01),
      pnl = CASE WHEN v_market > 0 THEN round(calc_trade_pnl(trade_type, amount, v_contract, _new_open_price, v_market), 2) ELSE pnl END,
      updated_at = now()
  WHERE id = _trade_id;
  -- account figures follow the trade
  UPDATE user_profiles SET updated_at = now() WHERE user_id = _trade.user_id;
  INSERT INTO admin_audit_log (admin_id, user_id, action, old_value, new_value, action_details)
  VALUES (_admin_id, _trade.user_id, 'trade_open_price_changed',
          jsonb_build_object('open_price', _trade.open_price, 'margin_used', _trade.margin_used),
          jsonb_build_object('open_price', _new_open_price),
          jsonb_build_object('trade_id', _trade_id));
  RETURN true;
END;
$$;
;

-- ---------- 0018_credit_withdrawals_and_housekeeping.sql ----------
SET search_path TO public, extensions;
-- 18. Withdrawals and deposits ---------------------------------------------
CREATE OR REPLACE FUNCTION public.process_withdrawal_request(_admin_id uuid, _request_id uuid, _action text, _admin_notes text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _request RECORD;
  _user_admin_id UUID;
  _withdrawable NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF _action NOT IN ('approved', 'rejected') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid action');
  END IF;
  SELECT * INTO _request FROM withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;
  SELECT admin_id INTO _user_admin_id FROM user_profiles WHERE user_id = _request.user_id FOR UPDATE;
  IF NOT (has_role(_admin_id, 'super_admin'::app_role) OR _user_admin_id = _admin_id) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  IF _request.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'This request was already ' || _request.status);
  END IF;
  IF _action = 'approved' THEN
    -- Only the client's own money can leave: credit and money held for open trades are excluded
    _withdrawable := account_withdrawable(_request.user_id);
    IF _request.amount > _withdrawable THEN
      RETURN json_build_object('success', false, 'error',
        format('Not enough withdrawable funds. The client can withdraw $%s right now (credit and money held for open trades are excluded).',
               to_char(_withdrawable, 'FM999,999,999,990.00')),
        'withdrawable', _withdrawable);
    END IF;
  END IF;
  UPDATE withdrawal_requests
  SET status = _action, admin_notes = _admin_notes, processed_at = now(), processed_by_admin = _admin_id
  WHERE id = _request_id;
  IF _action = 'approved' THEN
    UPDATE user_profiles SET balance = balance - _request.amount, updated_at = now() WHERE user_id = _request.user_id;
  END IF;
  RETURN json_build_object('success', true, 'message', 'Request processed successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.process_deposit_request(_admin_id uuid, _request_id uuid, _action text, _admin_notes text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _request RECORD;
  _user_admin_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF _action NOT IN ('approved', 'rejected') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid action');
  END IF;
  SELECT * INTO _request FROM deposit_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;
  SELECT admin_id INTO _user_admin_id FROM user_profiles WHERE user_id = _request.user_id FOR UPDATE;
  IF NOT (has_role(_admin_id, 'super_admin'::app_role) OR _user_admin_id = _admin_id) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  IF _request.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'This request was already ' || _request.status);
  END IF;
  UPDATE deposit_requests
  SET status = _action, admin_notes = _admin_notes, processed_at = now(), processed_by_admin = _admin_id
  WHERE id = _request_id;
  IF _action = 'approved' THEN
    UPDATE user_profiles SET balance = balance + _request.amount, updated_at = now() WHERE user_id = _request.user_id;
    PERFORM settle_account(_request.user_id, NULL);
  END IF;
  RETURN json_build_object('success', true, 'message', 'Request processed successfully');
END;
$$;

-- A client's own request always starts as "pending" and can never ask for more than is withdrawable
CREATE OR REPLACE FUNCTION public.guard_money_requests()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_avail numeric;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  NEW.amount := round(NEW.amount, 2);
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Enter a valid amount';
  END IF;
  NEW.status := 'pending';
  NEW.processed_at := NULL;
  NEW.processed_by_admin := NULL;
  NEW.admin_notes := NULL;
  NEW.created_at := now();
  IF TG_TABLE_NAME = 'withdrawal_requests' THEN
    IF NEW.withdrawal_type NOT IN ('crypto', 'wire') THEN
      RAISE EXCEPTION 'Invalid withdrawal method';
    END IF;
    -- already net of requests that are still waiting
    v_avail := public.get_withdrawable_amount(NEW.user_id);
    IF NEW.amount > v_avail THEN
      RAISE EXCEPTION 'You can withdraw up to $%. Credit, money held for open trades and requests already waiting are not available.',
        to_char(v_avail, 'FM999,999,999,990.00');
    END IF;
  ELSE
    IF NEW.deposit_type NOT IN ('crypto', 'wire') THEN
      RAISE EXCEPTION 'Invalid deposit method';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_money_requests() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_withdrawal_requests ON public.withdrawal_requests;
CREATE TRIGGER trg_guard_withdrawal_requests
BEFORE INSERT ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_money_requests();

DROP TRIGGER IF EXISTS trg_guard_deposit_requests ON public.deposit_requests;
CREATE TRIGGER trg_guard_deposit_requests
BEFORE INSERT ON public.deposit_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_money_requests();

-- 19. Pending orders: size and leverage are checked when the order is placed
CREATE OR REPLACE FUNCTION public.guard_trade_order_changes()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_min numeric; v_maxlev integer;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.order_type NOT IN ('limit','stop') OR NEW.trigger_price IS NULL OR NEW.trigger_price <= 0 OR NEW.amount IS NULL OR NEW.amount <= 0 THEN
      RAISE EXCEPTION 'Invalid pending order';
    END IF;
    SELECT COALESCE(min_trade_size, 0), GREATEST(COALESCE(max_leverage, 100), 100) INTO v_min, v_maxlev
    FROM public.assets WHERE id = NEW.asset_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Market not found';
    END IF;
    IF NEW.amount < v_min THEN
      RAISE EXCEPTION 'Minimum trade size is %', v_min;
    END IF;
    IF NEW.leverage IS NULL OR NEW.leverage < 1 OR NEW.leverage > v_maxlev THEN
      RAISE EXCEPTION 'Leverage must be between 1 and %', v_maxlev;
    END IF;
    NEW.status := 'pending'; NEW.filled_at := NULL; NEW.filled_trade_id := NULL; NEW.cancel_reason := NULL;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'pending' OR NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Only pending orders can be cancelled';
  END IF;
  NEW := OLD;
  NEW.status := 'cancelled'; NEW.cancel_reason := 'Cancelled by you'; NEW.updated_at := now();
  RETURN NEW;
END $$;

-- 20. Housekeeping ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_recalculate_user_margins(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  -- Re-derives margin in use, equity and free margin and applies the flat-account rule
  PERFORM settle_account(_user_id, NULL);
END;
$$;

DROP FUNCTION IF EXISTS public.recalculate_user_margins(uuid);
DROP FUNCTION IF EXISTS public.check_and_liquidate_positions(uuid);
DROP FUNCTION IF EXISTS public.update_user_balance_on_trade_close_safe();
DROP FUNCTION IF EXISTS public.update_user_balance_on_trade_open_safe();

CREATE OR REPLACE FUNCTION public.notify_profile_changes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM pg_notify('profile_updated', json_build_object(
    'user_id', NEW.user_id,
    'balance', NEW.balance,
    'credit', NEW.credit,
    'used_margin', NEW.used_margin,
    'available_margin', NEW.available_margin,
    'equity', NEW.equity,
    'updated_at', NEW.updated_at
  )::text);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_system_health_check()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  health_report JSON;
  user_count INTEGER;
  total_issues INTEGER := 0;
  margin_issues INTEGER := 0;
  balance_issues INTEGER := 0;
  orphaned_trades INTEGER := 0;
  invalid_orders INTEGER := 0;
  issues_array JSON[] := ARRAY[]::JSON[];
  user_record RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT COUNT(*) INTO user_count FROM user_profiles;
  FOR user_record IN
    SELECT up.user_id, up.balance, up.credit, up.used_margin, up.available_margin, up.equity,
           COALESCE(o.used, 0) AS calc_used,
           COALESCE(o.floating, 0) AS calc_floating,
           COALESCE(o.open_count, 0) AS open_count,
           l.credit_after AS ledger_credit
    FROM user_profiles up
    LEFT JOIN LATERAL (
      SELECT sum(t.margin_used) AS used, sum(COALESCE(t.pnl, 0)) AS floating, count(*) AS open_count
      FROM trades t WHERE t.user_id = up.user_id AND t.status = 'open') o ON true
    LEFT JOIN LATERAL (
      SELECT c.credit_after FROM credit_transactions c WHERE c.user_id = up.user_id
      ORDER BY c.created_at DESC, c.id DESC LIMIT 1) l ON true
  LOOP
    IF abs(user_record.used_margin - user_record.calc_used) > 0.01 THEN
      margin_issues := margin_issues + 1;
      total_issues := total_issues + 1;
      issues_array := array_append(issues_array, json_build_object(
        'type', 'margin_inconsistency', 'user_id', user_record.user_id,
        'stored_margin', user_record.used_margin, 'calculated_margin', user_record.calc_used, 'severity', 'high'));
    END IF;
    IF user_record.credit < 0 OR (user_record.open_count = 0 AND user_record.balance < 0 AND user_record.credit > 0) THEN
      balance_issues := balance_issues + 1;
      total_issues := total_issues + 1;
      issues_array := array_append(issues_array, json_build_object(
        'type', 'uncovered_negative_balance', 'user_id', user_record.user_id,
        'stored_balance', user_record.balance, 'credit', user_record.credit, 'severity', 'high'));
    END IF;
    IF (user_record.ledger_credit IS NOT NULL AND abs(user_record.ledger_credit - user_record.credit) > 0.01)
       OR (user_record.ledger_credit IS NULL AND user_record.credit <> 0) THEN
      balance_issues := balance_issues + 1;
      total_issues := total_issues + 1;
      issues_array := array_append(issues_array, json_build_object(
        'type', 'credit_ledger_mismatch', 'user_id', user_record.user_id,
        'stored_credit', user_record.credit, 'ledger_credit', user_record.ledger_credit, 'severity', 'high'));
    END IF;
    IF abs(user_record.available_margin
           - GREATEST(user_record.balance + user_record.credit + user_record.calc_floating - user_record.calc_used, 0)) > 1 THEN
      total_issues := total_issues + 1;
      issues_array := array_append(issues_array, json_build_object(
        'type', 'available_margin_error', 'user_id', user_record.user_id,
        'stored_available', user_record.available_margin,
        'calculated_available', GREATEST(user_record.balance + user_record.credit + user_record.calc_floating - user_record.calc_used, 0),
        'severity', 'medium'));
    END IF;
  END LOOP;
  SELECT COUNT(*) INTO orphaned_trades
  FROM trades t LEFT JOIN user_profiles up ON t.user_id = up.user_id
  WHERE up.user_id IS NULL;
  IF orphaned_trades > 0 THEN
    total_issues := total_issues + 1;
    issues_array := array_append(issues_array, json_build_object('type', 'orphaned_trades', 'count', orphaned_trades, 'severity', 'high'));
  END IF;
  SELECT COUNT(*) INTO invalid_orders
  FROM trade_orders o LEFT JOIN assets a ON o.asset_id = a.id
  WHERE a.id IS NULL;
  IF invalid_orders > 0 THEN
    total_issues := total_issues + 1;
    issues_array := array_append(issues_array, json_build_object('type', 'invalid_orders', 'count', invalid_orders, 'severity', 'medium'));
  END IF;
  health_report := json_build_object(
    'timestamp', now(),
    'status', CASE WHEN total_issues = 0 THEN 'healthy' ELSE 'issues_detected' END,
    'summary', json_build_object(
      'total_users', user_count,
      'total_issues', total_issues,
      'margin_issues', margin_issues,
      'balance_issues', balance_issues,
      'orphaned_trades', orphaned_trades,
      'invalid_orders', invalid_orders
    ),
    'issues', array_to_json(issues_array),
    'recommendations', CASE
      WHEN total_issues > 0 THEN json_build_array('Run the automatic fix to re-derive margin, equity and free margin for every account')
      ELSE json_build_array('System is healthy')
    END
  );
  RETURN health_report;
END;
$$;

-- 21. Bring every existing account in line with the new figures -------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.user_profiles LOOP
    PERFORM public.settle_account(r.user_id, NULL);
  END LOOP;
END $$;
;

-- ---------- 0019_credit_trade_delete_refund_order.sql ----------
SET search_path TO public, extensions;
CREATE OR REPLACE FUNCTION public.admin_delete_trade(_admin_id uuid, _trade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _trade RECORD; p RECORD;
  v_refund numeric := 0; v_reset_at timestamptz; v_ledger_reset_at timestamptz; v_closed_at timestamptz;
  v_outstanding numeric; v_undo_reset numeric := 0; v_restore numeric := 0; v_to_balance numeric := 0;
  v_before_reset boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT * INTO _trade FROM trades WHERE id = _trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = _admin_id AND user_id = _trade.user_id)
     AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  SELECT * INTO p FROM user_profiles WHERE user_id = _trade.user_id FOR UPDATE;

  DELETE FROM trades WHERE id = _trade_id;

  IF _trade.status = 'closed' AND COALESCE(_trade.pnl, 0) <> 0 THEN
    v_closed_at := COALESCE(_trade.closed_at, _trade.updated_at);
    -- last time this account's money was reset to zero
    SELECT max(created_at) INTO v_ledger_reset_at FROM credit_transactions
    WHERE user_id = _trade.user_id AND type = 'account_reset';
    SELECT GREATEST(v_ledger_reset_at, max(performed_at)) INTO v_reset_at FROM admin_audit_log
    WHERE user_id = _trade.user_id AND action = 'account_reset' AND action_details->>'reset_balance' = 'true';
    v_reset_at := COALESCE(v_reset_at, v_ledger_reset_at);

    IF v_reset_at IS NOT NULL AND v_closed_at <= v_reset_at THEN
      -- The reset already wiped this trade's result: removing it changes no money
      v_before_reset := true;
    ELSE
      v_refund := -_trade.pnl;  -- positive when the deleted trade was a loss
      IF v_refund > 0 THEN
        -- A refund unwinds the account's funding in reverse order, so credit can never come back as cash:
        -- a) negative balance the company cleared
        SELECT GREATEST(COALESCE(sum(balance_change), 0), 0) INTO v_outstanding
        FROM credit_transactions
        WHERE user_id = _trade.user_id AND type IN ('negative_balance_reset', 'negative_balance_reset_reversal')
          AND (v_ledger_reset_at IS NULL OR created_at > v_ledger_reset_at);
        v_undo_reset := LEAST(v_refund, v_outstanding);
        v_refund := v_refund - v_undo_reset;

        -- b) credit that was used to cover losses: returned as credit
        SELECT GREATEST(COALESCE(-sum(amount), 0), 0) INTO v_outstanding
        FROM credit_transactions
        WHERE user_id = _trade.user_id AND type IN ('loss_cover', 'loss_cover_reversal')
          AND (v_ledger_reset_at IS NULL OR created_at > v_ledger_reset_at);
        v_restore := LEAST(v_refund, v_outstanding);
        v_refund := v_refund - v_restore;

        -- c) what is left was the client's own money
        v_to_balance := v_refund;
      ELSE
        v_to_balance := v_refund;  -- taking a profit back
      END IF;

      UPDATE user_profiles SET balance = balance + v_to_balance, credit = credit + v_restore, updated_at = now()
      WHERE user_id = _trade.user_id;
      IF v_undo_reset > 0 THEN
        INSERT INTO credit_transactions (user_id, type, amount, balance_change, credit_after, balance_after, reason, performed_by, trade_id)
        VALUES (_trade.user_id, 'negative_balance_reset_reversal', 0, -v_undo_reset, p.credit + v_restore, p.balance + v_to_balance,
                'Trade deleted by admin: earlier negative-balance clearing no longer needed', _admin_id, _trade_id);
      END IF;
      IF v_restore > 0 THEN
        INSERT INTO credit_transactions (user_id, type, amount, balance_change, credit_after, balance_after, reason, performed_by, trade_id)
        VALUES (_trade.user_id, 'loss_cover_reversal', v_restore, -v_restore, p.credit + v_restore, p.balance + v_to_balance,
                'Trade deleted by admin: credit that covered losses was returned', _admin_id, _trade_id);
      END IF;
    END IF;
  END IF;

  PERFORM settle_account(_trade.user_id, NULL);

  INSERT INTO admin_audit_log (admin_id, user_id, action, old_value, action_details)
  VALUES (
    _admin_id, _trade.user_id, 'trade_deleted', row_to_json(_trade)::jsonb,
    jsonb_build_object('trade_id', _trade_id, 'was_open', _trade.status = 'open',
                       'balance_change', v_to_balance, 'credit_returned', v_restore,
                       'write_off_cancelled', v_undo_reset, 'closed_before_reset', v_before_reset)
  );
  RETURN jsonb_build_object(
    'success', true,
    'trade_id', _trade_id,
    'was_open', _trade.status = 'open',
    'margin_released', CASE WHEN _trade.status = 'open' THEN _trade.margin_used ELSE 0 END,
    'pnl_reversed', CASE WHEN _trade.status = 'closed' AND NOT v_before_reset THEN _trade.pnl ELSE 0 END,
    'balance_change', v_to_balance,
    'credit_returned', v_restore,
    'write_off_cancelled', v_undo_reset,
    'closed_before_reset', v_before_reset
  );
END;
$$;
;

-- ---------- Markets ----------
SET search_path TO public, extensions;
DELETE FROM public.assets;
INSERT INTO public.assets (symbol,name,category,price,change_24h,is_active,min_trade_size,max_leverage,spread,contract_size,base_currency,quote_currency,api_source,api_symbol,price_source) VALUES
('CATTLE','Live Cattle','commodities',227.25000000,0.5976,true,0.0100,20,0.1105,400,NULL,'USX','yahoo','LE=F','yahoo'),
('COCOA','Cocoa','commodities',5387.00000000,-0.4803,true,0.0100,20,2.7270,10,NULL,'USD','yahoo','CC=F','yahoo'),
('COFFEE','Coffee','commodities',269.60000000,2.6657,true,0.0100,20,0.1436,375,NULL,'USX','yahoo','KC=F','yahoo'),
('COPPER','Copper','commodities',5.33900000,-2.0906,true,0.0100,20,0.0032,25000,NULL,'USD','yahoo','HG=F','yahoo'),
('CORN','Corn','commodities',452.75000000,0.5552,true,0.0100,20,0.2239,50,NULL,'USX','yahoo','ZC=F','yahoo'),
('COTTON','Cotton','commodities',81.97000000,-0.0975,true,0.0100,20,0.0391,500,NULL,'USX','yahoo','CT=F','yahoo'),
('GASOLINE','Gasoline','commodities',2.43300000,-0.3114,true,0.0100,20,0.0016,42000,NULL,'USD','yahoo','RB=F','yahoo'),
('HEATOIL','Heating Oil','commodities',3.66460000,0.1585,true,0.0100,20,0.0023,42000,NULL,'USD','yahoo','HO=F','yahoo'),
('HOGS','Lean Hogs','commodities',55.75000000,7.6255,true,0.0100,20,0.0294,400,NULL,'USX','yahoo','HE=F','yahoo'),
('LUMBER','Lumber','commodities',550.00000000,0.5484,true,0.0100,20,0.2575,27,NULL,'USD','yahoo','LBR=F','yahoo'),
('NATGAS','Natural Gas','commodities',3.65700000,-0.1638,true,0.0100,100,0.0200,10000,NULL,NULL,'yahoo','NG=F','yahoo'),
('OATS','Oats','commodities',369.00000000,-2.3163,true,0.0100,20,0.1719,50,NULL,'USX','yahoo','ZO=F','yahoo'),
('OJUICE','Orange Juice','commodities',122.70000000,-6.6210,true,0.0100,20,0.0578,150,NULL,'USX','yahoo','OJ=F','yahoo'),
('SOYBEAN','Soybeans','commodities',1238.25000000,0.3444,true,0.0100,20,0.6171,50,NULL,'USX','yahoo','ZS=F','yahoo'),
('SUGAR','Sugar','commodities',18.27000000,3.4541,true,0.0100,20,0.0097,1120,NULL,'USX','yahoo','SB=F','yahoo'),
('UKOIL','Brent Crude Oil','commodities',89.84000000,1.1940,true,0.0100,100,0.0500,1000,NULL,NULL,'yahoo','BZ=F','yahoo'),
('USOIL','WTI Crude Oil','commodities',83.25000000,1.4625,true,0.0100,100,0.0500,1000,NULL,NULL,'yahoo','CL=F','yahoo'),
('WHEAT','Wheat','commodities',583.75000000,-0.9334,true,0.0100,20,0.3018,50,NULL,'USX','yahoo','ZW=F','yahoo'),
('XAGUSD','Silver','commodities',38.88500000,-5.7379,true,0.0100,100,0.0500,5000,NULL,NULL,'yahoo','SI=F','yahoo'),
('XAUUSD','Gold','commodities',3477.60000000,-3.1606,true,0.0100,100,0.5000,100,NULL,NULL,'yahoo','GC=F','yahoo'),
('XPDUSD','Palladium','commodities',822.00000000,-3.7809,true,0.0100,20,0.4939,100,NULL,'USD','yahoo','PA=F','yahoo'),
('XPTUSD','Platinum','commodities',1211.90000000,-3.6492,true,0.0100,100,2.0000,50,NULL,NULL,'yahoo','PL=F','yahoo'),
('1INCHUSD','1inch','crypto',0.05670000,-2.2414,true,1.0000,20,0.0000,1,'1INCH','USD','binance','1inchusdt','binance'),
('AAVEUSD','Aave','crypto',91.38000000,-2.4031,true,0.0010,100,0.0001,1,'AAVE','USD','binance','aaveusdt','binance'),
('ACHUSD','Alchemy Pay','crypto',0.00352000,-1.1236,true,1.0000,20,0.0000,1,'ACH','USD','binance','achusdt','binance'),
('ADAUSD','Cardano','crypto',0.14010000,-2.4373,true,1.0000,100,0.0001,1,NULL,NULL,'binance','adausdt','binance'),
('ALGOUSD','Algorand','crypto',0.07550000,-3.6990,true,1.0000,100,0.0001,1,'ALGO','USD','binance','algousdt','binance'),
('ANKRUSD','Ankr','crypto',0.00298000,1.0169,true,1.0000,20,0.0000,1,'ANKR','USD','binance','ankrusdt','binance'),
('APEUSD','ApeCoin','crypto',0.06850000,-1.5805,true,1.0000,20,0.0001,1,'APE','USD','binance','apeusdt','binance'),
('API3USD','API3','crypto',0.16640000,-2.2901,true,1.0000,20,0.0001,1,'API3','USD','binance','api3usdt','binance'),
('APTUSD','Aptos','crypto',0.35890000,-2.6580,true,0.1000,100,0.0001,1,'APT','USD','binance','aptusdt','binance'),
('ARBUSD','Arbitrum','crypto',0.16472900,1.7081,false,0.0100,100,0.0001,1,'ARB','USD','binance','arbusdt','live_api'),
('ARUSD','Arweave','crypto',3.17000000,-1.1660,false,0.0100,100,0.0001,1,'AR','USD','binance','arusdt','live_api'),
('ATOMUSD','Cosmos','crypto',1.22900000,-1.6013,true,0.1000,100,0.0001,1,'ATOM','USD','binance','atomusdt','binance'),
('AUDIOUSD','Audius','crypto',0.01050000,0.6711,true,1.0000,20,0.0000,1,'AUDIO','USD','binance','audiousdt','binance'),
('AVAXUSD','Avalanche','crypto',6.37000000,-2.1054,true,0.1000,100,0.0001,1,'AVAX','USD','binance','avaxusdt','binance'),
('AXSUSD','Axie Infinity','crypto',0.86404700,-0.1259,false,0.0100,100,0.0001,1,'AXS','USD','binance','axsusdt','live_api'),
('BANDUSD','Band Protocol','crypto',0.14520000,2.6874,true,1.0000,20,0.0001,1,'BAND','USD','binance','bandusdt','binance'),
('BATUSD','Basic Attention Token','crypto',0.07450000,-2.3591,true,1.0000,20,0.0001,1,'BAT','USD','binance','batusdt','binance'),
('BCHUSD','Bitcoin Cash','crypto',196.30000000,0.2042,true,0.0100,20,0.1414,1,'BCH','USD','binance','bchusdt','binance'),
('BLURUSD','Blur','crypto',0.01043000,29.7264,true,1.0000,20,0.0000,1,'BLUR','USD','binance','blurusdt','binance'),
('BNBUSD','Binance Coin','crypto',539.11000000,-1.0844,true,0.0100,100,1.2500,1,NULL,NULL,'binance','bnbusdt','binance'),
('BOMEUSD','Book of Meme','crypto',0.00044400,-1.2236,true,1.0000,20,0.0000,1,'BOME','USD','binance','bomeusdt','binance'),
('BONKUSD','Bonk','crypto',0.00000204,-2.8571,true,1.0000,20,0.0000,1,'BONK','USD','binance','bonkusdt','binance'),
('BTCUSD','Bitcoin','crypto',58558.01000000,-1.5199,true,0.0010,100,0.0100,1,NULL,NULL,'binance','btcusdt','binance'),
('CAKEUSD','PancakeSwap','crypto',1.50700000,-1.2451,true,0.0100,20,0.0010,1,'CAKE','USD','binance','cakeusdt','binance'),
('CELOUSD','Celo','crypto',0.05385000,-0.3700,true,1.0000,20,0.0000,1,'CELO','USD','binance','celousdt','binance'),
('CELRUSD','Celer Network','crypto',0.00179800,-2.9158,true,1.0000,20,0.0000,1,'CELR','USD','binance','celrusdt','binance'),
('CFXUSD','Conflux','crypto',0.03166000,-0.7835,true,1.0000,20,0.0000,1,'CFX','USD','binance','cfxusdt','binance'),
('CHZUSD','Chiliz','crypto',0.00869000,-0.1149,true,1.0000,20,0.0000,1,'CHZ','USD','binance','chzusdt','binance'),
('CKBUSD','Nervos','crypto',0.00077900,2.7704,true,1.0000,20,0.0000,1,'CKB','USD','binance','ckbusdt','binance'),
('COMPUSD','Compound','crypto',20.50000000,1.2023,false,0.0010,100,0.0001,1,'COMP','USD','binance','compusdt','live_api'),
('COTIUSD','COTI','crypto',0.00796000,-0.8717,true,1.0000,20,0.0000,1,'COTI','USD','binance','cotiusdt','binance'),
('CROUPD','Cronos','crypto',0.09500000,0.0000,false,1.0000,100,0.0001,1,'CRO','USD','yahoo',NULL,'pending'),
('CRVUSD','Curve DAO','crypto',0.28476100,-0.8099,false,0.0100,100,0.0001,1,'CRV','USD','binance','crvusdt','live_api'),
('DASHUSD','Dash','crypto',34.03000000,-0.5262,true,0.0100,20,0.0243,1,'DASH','USD','binance','dashusdt','binance'),
('DOGEUSD','Dogecoin','crypto',0.05359000,-2.1366,true,1.0000,100,0.0001,1,'DOGE','USD','binance','dogeusdt','binance'),
('DOGSUSD','DOGS','crypto',0.00002385,-0.5006,true,1.0000,20,0.0000,1,'DOGS','USD','binance','dogsusdt','binance'),
('DOTUSD','Polkadot','crypto',0.63700000,-1.8490,true,0.1000,100,0.0010,1,NULL,NULL,'binance','dotusdt','binance'),
('DYDXUSD','dYdX','crypto',0.06687000,-3.8533,true,1.0000,20,0.0001,1,'DYDX','USD','binance','dydxusdt','binance'),
('EGLDUSD','MultiversX','crypto',2.18900000,1.3426,true,0.0100,20,0.0017,1,'EGLD','USD','binance','egldusdt','binance'),
('EIGENUSD','EigenLayer','crypto',0.10560000,-3.4735,true,1.0000,20,0.0001,1,'EIGEN','USD','binance','eigenusdt','binance'),
('ENAUSD','Ethena','crypto',0.09340000,-4.5965,true,1.0000,20,0.0001,1,'ENA','USD','binance','enausdt','binance'),
('ENJUSD','Enjin Coin','crypto',0.02403937,0.0316,false,0.1000,100,0.0001,1,'ENJ','USD','binance','enjusdt','live_api'),
('ETCUSD','Ethereum Classic','crypto',5.67000000,-0.8741,true,0.0100,20,0.0036,1,'ETC','USD','binance','etcusdt','binance'),
('ETHFIUSD','ether.fi','crypto',0.43880000,-3.4543,true,1.0000,20,0.0003,1,'ETHFI','USD','binance','ethfiusdt','binance'),
('ETHUSD','Ethereum','crypto',1644.89000000,-1.4546,true,0.0100,100,0.0100,1,NULL,NULL,'binance','ethusdt','binance'),
('FETUSD','Artificial Superintelligence','crypto',0.10390000,-2.0735,true,1.0000,20,0.0001,1,'FET','USD','binance','fetusdt','binance'),
('FILUSD','Filecoin','crypto',0.51760000,-3.6665,true,0.0100,100,0.0001,1,'FIL','USD','binance','filusdt','binance'),
('FLOKIUSD','Floki Inu','crypto',0.00003200,0.0000,false,1000.0000,100,0.0001,1,'FLOKI','USD','binance','flokiusdt','pending'),
('FLOWUSD','Flow','crypto',1.10000000,0.0000,false,0.0100,100,0.0001,1,'FLOW','USD','binance','flowusdt','pending'),
('FTMUSD','Fantom','crypto',0.04696764,0.0000,false,1.0000,100,0.0001,1,'FTM','USD','binance','ftmusdt','live_api'),
('GALAUSD','Gala','crypto',0.00170897,0.0480,false,1.0000,100,0.0001,1,'GALA','USD','binance','galausdt','live_api'),
('GLMUSD','Golem','crypto',0.08780000,-4.0437,true,1.0000,20,0.0001,1,'GLM','USD','binance','glmusdt','binance'),
('GMTUSD','STEPN','crypto',0.00496000,0.0000,true,1.0000,20,0.0000,1,'GMT','USD','binance','gmtusdt','binance'),
('GMXUSD','GMX','crypto',7.74000000,0.3891,true,0.0100,20,0.0041,1,'GMX','USD','binance','gmxusdt','binance'),
('GRTUSD','The Graph','crypto',0.01590000,-0.8728,true,0.1000,100,0.0001,1,'GRT','USD','binance','grtusdt','binance'),
('HBARUSD','Hedera','crypto',0.04980000,-0.6385,true,1.0000,20,0.0000,1,'HBAR','USD','binance','hbarusdt','binance'),
('HOTUSD','Holo','crypto',0.00030700,-4.3614,true,1.0000,20,0.0000,1,'HOT','USD','binance','hotusdt','binance'),
('HYPEUSD','Hyperliquid','crypto',58.00000000,-4.6523,true,0.0100,20,0.0438,1,'HYPE','USD','binance','hypeusdt','binance'),
('ICPUSD','Internet Computer','crypto',1.98300000,-0.9985,true,0.1000,100,0.0001,1,'ICP','USD','binance','icpusdt','binance'),
('IMXUSD','Immutable','crypto',0.08720000,-0.4566,true,1.0000,20,0.0001,1,'IMX','USD','binance','imxusdt','binance'),
('INJUSD','Injective','crypto',5.73600000,-2.9606,true,0.0100,20,0.0036,1,'INJ','USD','binance','injusdt','binance'),
('IOSTUSD','IOST','crypto',0.00058700,-0.3396,true,1.0000,20,0.0000,1,'IOST','USD','binance','iostusdt','binance'),
('IOTAUSD','IOTA','crypto',0.03030000,0.3311,true,1.0000,20,0.0000,1,'IOTA','USD','binance','iotausdt','binance'),
('IOTXUSD','IoTeX','crypto',0.00233400,0.8207,true,1.0000,20,0.0000,1,'IOTX','USD','binance','iotxusdt','binance'),
('JASMYUSD','JasmyCoin','crypto',0.00304000,-0.3279,true,1.0000,20,0.0000,1,'JASMY','USD','binance','jasmyusdt','binance'),
('JTOUSD','Jito','crypto',0.22040000,-4.6300,true,1.0000,20,0.0002,1,'JTO','USD','binance','jtousdt','binance'),
('JUPUSD','Jupiter','crypto',0.21500000,-3.8031,true,1.0000,20,0.0001,1,'JUP','USD','binance','jupusdt','binance'),
('KAVAUSD','Kava','crypto',0.02409000,-0.1658,true,1.0000,20,0.0000,1,'KAVA','USD','binance','kavausdt','binance'),
('KSMUSD','Kusama','crypto',35.00000000,0.0000,false,0.0010,100,0.0001,1,'KSM','USD','binance','ksmusdt','pending'),
('LDOUSD','Lido DAO','crypto',0.33474500,-1.4818,false,0.0100,100,0.0001,1,'LDO','USD','binance','ldousdt','live_api'),
('LINKUSD','Chainlink','crypto',8.69900000,-1.1477,true,0.0100,100,0.0500,1,NULL,NULL,'binance','linkusdt','binance'),
('LPTUSD','Livepeer','crypto',1.02700000,0.7851,true,0.0100,20,0.0007,1,'LPT','USD','binance','lptusdt','binance'),
('LTCUSD','Litecoin','crypto',40.92000000,1.8164,true,0.0100,100,0.1500,1,NULL,NULL,'binance','ltcusdt','binance'),
('MANAUSD','Decentraland','crypto',0.05430000,-1.8083,true,0.1000,100,0.0001,1,'MANA','USD','binance','manausdt','binance'),
('MASKUSD','Mask Network','crypto',0.26600000,-0.7463,true,1.0000,20,0.0002,1,'MASK','USD','binance','maskusdt','binance'),
('MATICUSD','Polygon','crypto',0.37940000,-0.2891,false,0.0100,100,0.0050,1,NULL,NULL,'binance','maticusdt','binance'),
('MEMEUSD','Memecoin','crypto',0.00028200,-0.7042,true,1.0000,20,0.0000,1,'MEME','USD','binance','memeusdt','binance'),
('MINAUSD','Mina Protocol','crypto',0.95000000,0.0000,false,0.0100,100,0.0001,1,'MINA','USD','binance','minausdt','pending'),
('MKRUSD','Maker','crypto',1450.00000000,0.0000,false,0.0001,100,0.0001,1,'MKR','USD','binance','mkrusdt','pending'),
('MORPHOUSD','Morpho','crypto',1.52000000,-3.2463,true,0.0100,20,0.0011,1,'MORPHO','USD','binance','morphousdt','binance'),
('NEARUSD','Near Protocol','crypto',2.74600000,-2.8996,true,0.1000,100,0.0001,1,'NEAR','USD','binance','nearusdt','binance'),
('NEOUSD','Neo','crypto',1.49100000,-1.7787,true,0.0100,20,0.0010,1,'NEO','USD','binance','neousdt','binance'),
('NOTUSD','Notcoin','crypto',0.00027700,-3.1469,true,1.0000,20,0.0000,1,'NOT','USD','binance','notusdt','binance'),
('OKBUSD','OKB','crypto',48.00000000,0.0000,false,0.0100,100,0.0001,1,'OKB','USD','binance','okbusdt','pending'),
('ONDOUSD','Ondo','crypto',0.27000000,-2.7728,true,1.0000,20,0.0002,1,'ONDO','USD','binance','ondousdt','binance'),
('ONEUSD','Harmony','crypto',0.00091600,-2.6567,true,1.0000,20,0.0000,1,'ONE','USD','binance','oneusdt','binance'),
('ONTUSD','Ontology','crypto',0.03302000,-2.1919,true,1.0000,20,0.0000,1,'ONT','USD','binance','ontusdt','binance'),
('OPUSD','Optimism','crypto',0.11287400,-3.8430,false,0.0100,100,0.0001,1,'OP','USD','binance','opusdt','live_api'),
('ORDIUSD','ORDI','crypto',2.50500000,-1.6490,true,0.0100,20,0.0018,1,'ORDI','USD','binance','ordiusdt','binance'),
('PENDLEUSD','Pendle','crypto',1.18900000,-4.5746,true,0.0100,20,0.0009,1,'PENDLE','USD','binance','pendleusdt','binance'),
('PENGUUSD','Pudgy Penguins','crypto',0.00413200,-1.0536,true,1.0000,20,0.0000,1,'PENGU','USD','binance','penguusdt','binance'),
('PEOPLEUSD','ConstitutionDAO','crypto',0.00468000,-1.4737,true,1.0000,20,0.0000,1,'PEOPLE','USD','binance','peopleusdt','binance'),
('PEPEUSD','Pepe','crypto',0.00000502,2.4208,false,1000.0000,100,0.0001,1,'PEPE','USD','binance','pepeusdt','live_api'),
('POLUSD','Polygon (POL)','crypto',0.07480000,-1.0451,true,1.0000,20,0.0000,1,'POL','USD','binance','polusdt','binance'),
('PYTHUSD','Pyth Network','crypto',0.04684000,-3.3230,true,1.0000,20,0.0000,1,'PYTH','USD','binance','pythusdt','binance'),
('QNTUSD','Quant','crypto',115.00000000,0.0000,false,0.0010,100,0.0001,1,'QNT','USD','binance','qntusdt','pending'),
('QTUMUSD','Qtum','crypto',0.60800000,-3.1847,true,1.0000,20,0.0004,1,'QTUM','USD','binance','qtumusdt','binance'),
('RAYUSD','Raydium','crypto',1.22780000,-1.3498,true,0.0100,20,0.0008,1,'RAY','USD','binance','rayusdt','binance'),
('RENDERUSD','Render Token','crypto',7.20000000,0.0000,false,0.0100,100,0.0001,1,'RENDER','USD','binance','renderusdt','pending'),
('ROSEUSD','Oasis','crypto',0.00409000,-2.8504,true,1.0000,20,0.0000,1,'ROSE','USD','binance','roseusdt','binance'),
('RPLUSD','Rocket Pool','crypto',28.00000000,0.0000,false,0.0010,100,0.0001,1,'RPL','USD','binance','rplusdt','pending'),
('RUNEUSD','THORChain','crypto',0.51300000,1.7857,true,1.0000,20,0.0003,1,'RUNE','USD','binance','runeusdt','binance'),
('RVNUSD','Ravencoin','crypto',0.00082400,-1.5532,true,1.0000,20,0.0000,1,'RVN','USD','binance','rvnusdt','binance'),
('SANDUSD','The Sandbox','crypto',0.03161000,-0.5349,true,0.1000,100,0.0001,1,'SAND','USD','binance','sandusdt','binance'),
('SEIUSD','Sei','crypto',0.03199000,-2.9135,true,1.0000,20,0.0000,1,'SEI','USD','binance','seiusdt','binance'),
('SHIBUSD','Shiba Inu','crypto',0.00000468,-2.1386,false,1000.0000,100,0.0001,1,'SHIB','USD','binance','shibusdt','live_api'),
('SKLUSD','SKALE','crypto',0.00271000,-1.8116,true,1.0000,20,0.0000,1,'SKL','USD','binance','sklusdt','binance'),
('SNXUSD','Synthetix','crypto',2.80000000,0.0000,false,0.0100,100,0.0001,1,'SNX','USD','binance','snxusdt','pending'),
('SOLUSD','Solana','crypto',67.84000000,-1.8377,true,0.0100,100,0.2500,1,NULL,NULL,'binance','solusdt','binance'),
('SSVUSD','SSV Network','crypto',1.99300000,29.0803,true,0.0100,20,0.0011,1,'SSV','USD','binance','ssvusdt','binance'),
('STETHUSD','Lido Staked ETH','crypto',3200.00000000,0.0000,false,0.0001,100,0.0001,1,'STETH','USD','binance','stethusdt','pending'),
('STRKUSD','Starknet','crypto',0.02965000,-0.7033,true,1.0000,20,0.0000,1,'STRK','USD','binance','strkusdt','binance'),
('STXUSD','Stacks','crypto',0.25330000,-0.2756,true,1.0000,20,0.0002,1,'STX','USD','binance','stxusdt','binance'),
('SUIUSD','Sui','crypto',0.63180000,-1.5428,true,1.0000,20,0.0005,1,'SUI','USD','binance','suiusdt','binance'),
('SUSHIUSD','SushiSwap','crypto',1.20000000,0.0000,false,0.0100,100,0.0001,1,'SUSHI','USD','binance','sushiusdt','pending'),
('TAOUSD','Bittensor','crypto',174.40000000,-3.7528,true,0.0100,20,0.1175,1,'TAO','USD','binance','taousdt','binance'),
('THETAUSD','Theta Network','crypto',1.45000000,0.0000,false,0.0100,100,0.0001,1,'THETA','USD','binance','thetausdt','pending'),
('TIAUSD','Celestia','crypto',0.31440000,-3.5287,true,1.0000,20,0.0002,1,'TIA','USD','binance','tiausdt','binance'),
('TRUMPUSD','Official Trump','crypto',0.80600000,-1.4670,true,0.0100,20,0.0009,1,'TRUMP','USD','binance','trumpusdt','binance'),
('TRXUSD','Tron','crypto',0.30360000,-1.3966,true,5.0000,100,0.0001,1,'TRX','USD','binance','trxusdt','binance'),
('TURBOUSD','Turbo','crypto',0.00055200,0.7299,true,1.0000,20,0.0000,1,'TURBO','USD','binance','turbousdt','binance'),
('TWTUSD','Trust Wallet Token','crypto',0.29620000,-1.2667,true,1.0000,20,0.0002,1,'TWT','USD','binance','twtusdt','binance'),
('UMAUSD','UMA','crypto',0.23100000,-1.2821,true,1.0000,20,0.0002,1,'UMA','USD','binance','umausdt','binance'),
('UNIUSD','Uniswap','crypto',4.49700000,-3.8897,true,0.1000,100,0.0001,1,'UNI','USD','binance','uniusdt','binance'),
('VETUSD','VeChain','crypto',0.00585001,-1.1815,false,10.0000,100,0.0001,1,'VET','USD','binance','vetusdt','live_api'),
('VIRTUALUSD','Virtuals Protocol','crypto',0.33910000,-4.2361,true,1.0000,20,0.0003,1,'VIRTUAL','USD','binance','virtualusdt','binance'),
('WBTCUSD','Wrapped Bitcoin','crypto',65000.00000000,0.0000,false,0.0000,100,0.0001,1,'WBTC','USD','binance','wbtcusdt','pending'),
('WIFUSD','dogwifhat','crypto',0.11840000,-0.9205,true,1.0000,20,0.0001,1,'WIF','USD','binance','wifusdt','binance'),
('WLDUSD','Worldcoin','crypto',0.23160000,0.1297,true,1.0000,20,0.0002,1,'WLD','USD','binance','wldusdt','binance'),
('XECUSD','eCash','crypto',0.00000497,0.6073,true,1.0000,20,0.0000,1,'XEC','USD','binance','xecusdt','binance'),
('XLMUSD','Stellar','crypto',0.12290000,0.0000,true,1.0000,20,0.0001,1,'XLM','USD','binance','xlmusdt','binance'),
('XMRUSD','Monero','crypto',155.00000000,0.0000,false,0.0010,100,0.0001,1,'XMR','USD','binance','xmrusdt','pending'),
('XRPUSD','Ripple','crypto',0.90620000,-0.5706,true,1.0000,100,0.0001,1,NULL,NULL,'binance','xrpusdt','binance'),
('XTZUSD','Tezos','crypto',0.20850000,0.6274,true,1.0000,20,0.0001,1,'XTZ','USD','binance','xtzusdt','binance'),
('YFIUSD','yearn.finance','crypto',1539.00000000,-5.1756,true,0.0100,20,1.0150,1,'YFI','USD','binance','yfiusdt','binance'),
('ZECUSD','Zcash','crypto',694.58000000,-2.5780,true,0.0100,20,0.6190,1,'ZEC','USD','binance','zecusdt','binance'),
('ZILUSD','Zilliqa','crypto',0.00082300,1.8564,true,1.0000,20,0.0000,1,'ZIL','USD','binance','zilusdt','binance'),
('ZROUSD','LayerZero','crypto',0.94700000,-8.1474,true,0.0100,20,0.0009,1,'ZRO','USD','binance','zrousdt','binance'),
('ZRXUSD','0x','crypto',0.07560000,0.0000,true,1.0000,20,0.0000,1,'ZRX','USD','binance','zrxusdt','binance'),
('AUDCAD','AUD / CAD','forex',0.93730000,-1.0556,true,0.0100,100,0.0001,100000,'AUD','CAD','yahoo','AUDCAD=X','yahoo'),
('AUDCHF','AUD / CHF','forex',0.54740000,-1.3160,true,0.0100,100,0.0001,100000,'AUD','CHF','yahoo','AUDCHF=X','yahoo'),
('AUDJPY','Australian Dollar / Japanese Yen','forex',104.69500000,-1.0266,true,0.0100,100,0.0100,100000,'AUD','JPY','yahoo','AUDJPY=X','yahoo'),
('AUDNZD','Australian Dollar / New Zealand Dollar','forex',1.20540000,-0.5117,true,0.0100,100,0.0001,100000,'AUD','NZD','yahoo','AUDNZD=X','yahoo'),
('AUDUSD','Australian Dollar / US Dollar','forex',0.65960000,-0.7374,true,0.0100,100,0.0001,100000,'AUD','USD','yahoo','AUDUSD=X','yahoo'),
('CADJPY','CAD / JPY','forex',111.70200000,0.0914,true,0.0100,100,0.0100,100000,'CAD','JPY','yahoo','CADJPY=X','yahoo'),
('CHFJPY','CHF / JPY','forex',191.24200000,0.3784,true,0.0100,100,0.0100,100000,'CHF','JPY','yahoo','CHFJPY=X','yahoo'),
('EURAUD','Euro / Australian Dollar','forex',1.66370000,0.8242,true,0.0100,100,0.0002,100000,'EUR','AUD','yahoo','EURAUD=X','yahoo'),
('EURCAD','EUR / CAD','forex',1.55940000,-0.3005,true,0.0100,100,0.0001,100000,'EUR','CAD','yahoo','EURCAD=X','yahoo'),
('EURCHF','Euro / Swiss Franc','forex',0.91080000,-0.5568,true,0.0100,100,0.0001,100000,'EUR','CHF','yahoo','EURCHF=X','yahoo'),
('EURGBP','Euro / British Pound','forex',0.83760000,0.2154,true,0.0100,100,0.0001,100000,'EUR','GBP','yahoo','EURGBP=X','yahoo'),
('EURJPY','Euro / Japanese Yen','forex',174.20800000,-0.2411,true,0.0100,100,0.0100,100000,'EUR','JPY','yahoo','EURJPY=X','yahoo'),
('EURNOK','EUR / NOK','forex',10.78010000,0.3556,true,0.0100,100,0.0005,100000,'EUR','NOK','yahoo','EURNOK=X','yahoo'),
('EURNZD','Euro / New Zealand Dollar','forex',2.00570000,0.3051,true,0.0100,100,0.0002,100000,'EUR','NZD','yahoo','EURNZD=X','yahoo'),
('EURPLN','EUR / PLN','forex',4.47800000,0.5208,true,0.0100,100,0.0002,100000,'EUR','PLN','yahoo','EURPLN=X','yahoo'),
('EURSEK','EUR / SEK','forex',11.24270000,0.2023,true,0.0100,100,0.0005,100000,'EUR','SEK','yahoo','EURSEK=X','yahoo'),
('EURTRY','EUR / TRY','forex',55.59890000,0.1331,true,0.0100,100,0.0028,100000,'EUR','TRY','yahoo','EURTRY=X','yahoo'),
('EURUSD','Euro / US Dollar','forex',1.09760000,0.0821,true,0.0100,100,0.0001,100000,'EUR','USD','yahoo','EURUSD=X','yahoo'),
('GBPAUD','British Pound / Australian Dollar','forex',1.98590000,0.6385,true,0.0100,100,0.0002,100000,'GBP','AUD','yahoo','GBPAUD=X','yahoo'),
('GBPCAD','British Pound / Canadian Dollar','forex',1.86170000,-0.4545,true,0.0100,100,0.0002,100000,'GBP','CAD','yahoo','GBPCAD=X','yahoo'),
('GBPCHF','GBP / CHF','forex',1.08740000,-0.7394,true,0.0100,100,0.0001,100000,'GBP','CHF','yahoo','GBPCHF=X','yahoo'),
('GBPJPY','British Pound / Japanese Yen','forex',207.98100000,-0.4294,true,0.0100,100,0.0100,100000,'GBP','JPY','yahoo','GBPJPY=X','yahoo'),
('GBPNZD','GBP / NZD','forex',2.39420000,0.0752,true,0.0100,100,0.0001,100000,'GBP','NZD','yahoo','GBPNZD=X','yahoo'),
('GBPUSD','British Pound / US Dollar','forex',1.30980000,-0.1372,true,0.0100,100,0.0001,100000,'GBP','USD','yahoo','GBPUSD=X','yahoo'),
('GBPZAR','GBP / ZAR','forex',23.08540000,0.5654,true,0.0100,100,0.0011,100000,'GBP','ZAR','yahoo','GBPZAR=X','yahoo'),
('NZDCAD','NZD / CAD','forex',0.77750000,-0.5118,true,0.0100,100,0.0001,100000,'NZD','CAD','yahoo','NZDCAD=X','yahoo'),
('NZDJPY','New Zealand Dollar / Japanese Yen','forex',86.86500000,-0.3682,true,0.0100,100,0.0100,100000,'NZD','JPY','yahoo','NZDJPY=X','yahoo'),
('NZDUSD','New Zealand Dollar / US Dollar','forex',0.54720000,-0.1642,true,0.0100,100,0.0001,100000,'NZD','USD','yahoo','NZDUSD=X','yahoo'),
('USDCAD','US Dollar / Canadian Dollar','forex',1.42130000,-0.3575,true,0.0100,100,0.0001,100000,'USD','CAD','yahoo','CAD=X','yahoo'),
('USDCHF','US Dollar / Swiss Franc','forex',0.83010000,-0.5749,true,0.0100,100,0.0001,100000,'USD','CHF','yahoo','CHF=X','yahoo'),
('USDCNH','USD / CNH','forex',6.66780000,0.0645,true,0.0100,100,0.0003,100000,'USD','CNH','yahoo','CNH=X','yahoo'),
('USDCZK','USD / CZK','forex',22.26060000,0.1151,true,0.0100,100,0.0011,100000,'USD','CZK','yahoo','CZK=X','yahoo'),
('USDDKK','USD / DKK','forex',6.81060000,-0.0514,true,0.0100,100,0.0003,100000,'USD','DKK','yahoo','DKK=X','yahoo'),
('USDHKD','USD / HKD','forex',7.83690000,-0.0523,true,0.0100,100,0.0004,100000,'USD','HKD','yahoo','HKD=X','yahoo'),
('USDHUF','USD / HUF','forex',340.21000000,0.9945,true,0.0100,100,0.0164,100000,'USD','HUF','yahoo','HUF=X','yahoo'),
('USDINR','USD / INR','forex',92.22000000,-0.7320,true,0.0100,100,0.0047,100000,'USD','INR','yahoo','INR=X','yahoo'),
('USDJPY','US Dollar / Japanese Yen','forex',158.76000000,-0.3027,true,0.0100,100,0.0100,100000,'USD','JPY','yahoo','JPY=X','yahoo'),
('USDMXN','US Dollar / Mexican Peso','forex',19.67400000,1.3706,true,0.0100,100,0.0100,100000,'USD','MXN','yahoo','MXN=X','yahoo'),
('USDNOK','USD / NOK','forex',9.82480000,0.4642,true,0.0100,100,0.0005,100000,'USD','NOK','yahoo','NOK=X','yahoo'),
('USDPLN','USD / PLN','forex',4.08090000,0.4702,true,0.0100,100,0.0002,100000,'USD','PLN','yahoo','PLN=X','yahoo'),
('USDSEK','USD / SEK','forex',10.24600000,0.2397,true,0.0100,100,0.0005,100000,'USD','SEK','yahoo','SEK=X','yahoo'),
('USDSGD','USD / SGD','forex',1.29060000,0.1241,true,0.0100,100,0.0001,100000,'USD','SGD','yahoo','SGD=X','yahoo'),
('USDTHB','USD / THB','forex',34.07000000,0.5015,true,0.0100,100,0.0017,100000,'USD','THB','yahoo','THB=X','yahoo'),
('USDTRY','USD / TRY','forex',50.67460000,0.0675,true,0.0100,100,0.0025,100000,'USD','TRY','yahoo','TRY=X','yahoo'),
('USDZAR','US Dollar / South African Rand','forex',17.62500000,0.6165,true,0.0100,100,0.0200,100000,'USD','ZAR','yahoo','ZAR=X','yahoo'),
('AUS200','Australia 200 (ASX)','indices',8692.40000000,1.4211,true,0.0100,100,1.5000,1,NULL,NULL,'yahoo','^AXJO','yahoo'),
('BRA50','Bovespa','indices',164856.47000000,0.4672,true,0.0100,50,16.7922,1,NULL,'BRL','yahoo','^BVSP','yahoo'),
('CAN60','TSX Composite','indices',33563.75000000,-1.1735,true,0.0100,50,3.5620,1,NULL,'CAD','yahoo','^GSPTSE','yahoo'),
('CHINA50','Shanghai Composite','indices',3476.47000000,-1.7655,true,0.0100,50,0.3599,1,NULL,'CNY','yahoo','000001.SS','yahoo'),
('ESP35','IBEX 35','indices',18635.80000000,-1.9983,true,0.0100,50,1.8653,1,NULL,'EUR','yahoo','^IBEX','yahoo'),
('EU50','Euro Stoxx 50','indices',5894.46000000,-1.8205,true,0.0100,50,0.6131,1,NULL,'EUR','yahoo','^STOXX50E','yahoo'),
('FRA40','France 40 (CAC)','indices',7980.57000000,-0.7452,true,0.0100,100,1.2000,1,NULL,NULL,'yahoo','^FCHI','yahoo'),
('GER40','Germany 40 (DAX)','indices',24702.13000000,-1.2618,true,0.0100,100,1.5000,1,NULL,NULL,'yahoo','^GDAXI','yahoo'),
('HK50','Hang Seng','indices',21966.01000000,-1.8660,true,0.0100,50,2.3294,1,NULL,'HKD','yahoo','^HSI','yahoo'),
('IND50','Nifty 50','indices',25819.25000000,1.8525,true,0.0100,50,2.3053,1,NULL,'INR','yahoo','^NSEI','yahoo'),
('ITA40','FTSE MIB','indices',47249.15000000,-1.8122,true,0.0100,50,4.9501,1,NULL,'EUR','yahoo','FTSEMIB.MI','yahoo'),
('JPN225','Japan 225 (Nikkei)','indices',57011.62000000,-2.7846,true,0.0100,100,4.0000,1,NULL,NULL,'yahoo','^N225','yahoo'),
('KOR200','KOSPI','indices',4697.51000000,-6.1630,true,0.0100,50,0.5731,1,NULL,'KRW','yahoo','^KS11','yahoo'),
('NED25','AEX 25','indices',1063.44000000,-1.2966,true,0.0100,50,0.1134,1,NULL,'EUR','yahoo','^AEX','yahoo'),
('SUI20','SMI 20','indices',14664.92000000,-0.4681,true,0.0100,50,1.4811,1,NULL,'CHF','yahoo','^SSMI','yahoo'),
('UK100','UK 100 (FTSE)','indices',10426.94000000,-0.3834,true,0.0100,100,1.2000,1,NULL,NULL,'yahoo','^FTSE','yahoo'),
('US100','NASDAQ 100','indices',25181.09800000,-3.9409,true,0.0100,100,1.0000,1,NULL,NULL,'yahoo','^NDX','yahoo'),
('US2000','Russell 2000','indices',2637.29400000,-1.7746,true,0.0100,50,0.2812,1,NULL,'USD','yahoo','^RUT','yahoo'),
('US30','Dow Jones 30','indices',49403.76000000,-1.2294,true,0.0100,100,2.0000,1,NULL,NULL,'yahoo','^DJI','yahoo'),
('US500','S&P 500','indices',7030.15000000,-2.3738,true,0.0100,100,0.5000,1,NULL,NULL,'yahoo','^GSPC','yahoo'),
('VIX','Volatility Index','indices',33.61000000,27.5038,true,0.0100,50,0.0019,1,NULL,'USD','yahoo','^VIX','yahoo'),
('AAPL','Apple Inc.','stocks',348.81000000,-1.4856,true,0.0100,100,0.0100,1,NULL,NULL,'yahoo','AAPL','yahoo'),
('ABBV','AbbVie Inc.','stocks',296.55000000,-1.2422,true,0.0100,5,0.1474,1,NULL,'USD','yahoo','ABBV','yahoo'),
('ABNB','Airbnb, Inc.','stocks',171.29500000,-1.2083,true,0.0100,5,0.0822,1,NULL,'USD','yahoo','ABNB','yahoo'),
('ABT','Abbott Laboratories','stocks',108.09800000,2.5695,true,0.0100,5,0.0531,1,NULL,'USD','yahoo','ABT','yahoo'),
('ACN','Accenture plc','stocks',240.85000000,3.6717,true,0.0100,5,0.1291,1,NULL,'USD','yahoo','ACN','yahoo'),
('ADBE','Adobe Inc.','stocks',233.60000000,0.6549,true,0.0100,5,0.1251,1,NULL,'USD','yahoo','ADBE','yahoo'),
('ADI','Analog Devices, Inc.','stocks',313.93000000,0.3131,true,0.0100,5,0.2086,1,NULL,'USD','yahoo','ADI','yahoo'),
('ADP','Automatic Data Processing, Inc.','stocks',316.03000000,1.6860,true,0.0100,5,0.1469,1,NULL,'USD','yahoo','ADP','yahoo'),
('ADS_DE','Adidas','stocks',170.45000000,1.3678,true,0.0100,5,0.1348,1,NULL,'EUR','yahoo','ADS.DE','yahoo'),
('ADYEN_AS','Adyen','stocks',831.90000000,-0.6331,true,0.0100,5,0.6615,1,NULL,'EUR','yahoo','ADYEN.AS','yahoo'),
('AI_PA','Air Liquide','stocks',188.46000000,0.1807,true,0.0100,5,0.1447,1,NULL,'EUR','yahoo','AI.PA','yahoo'),
('AIR_PA','Airbus','stocks',190.00000000,-1.8798,true,0.0100,5,0.1539,1,NULL,'EUR','yahoo','AIR.PA','yahoo'),
('ALV_DE','Allianz','stocks',453.50000000,-0.3953,true,0.0100,5,0.3510,1,NULL,'EUR','yahoo','ALV.DE','yahoo'),
('AMAT','Applied Materials, Inc.','stocks',292.22000000,-9.7418,true,0.0100,5,0.1950,1,NULL,'USD','yahoo','AMAT','yahoo'),
('AMD','Advanced Micro Devices, Inc.','stocks',375.95000000,-9.0304,true,0.0100,5,0.2524,1,NULL,'USD','yahoo','AMD','yahoo'),
('AMGN','Amgen Inc.','stocks',466.32000000,-1.6068,true,0.0100,5,0.2330,1,NULL,'USD','yahoo','AMGN','yahoo'),
('AMZN','Amazon.com Inc.','stocks',240.35000000,-4.7326,true,0.0100,100,0.0300,1,NULL,NULL,'yahoo','AMZN','yahoo'),
('ARM','Arm Holdings plc','stocks',149.49000000,-7.4709,true,0.0100,5,0.1030,1,NULL,'USD','yahoo','ARM','yahoo'),
('ASML','ASML Holding N.V.','stocks',1244.72000000,-6.8365,true,0.0100,5,0.7830,1,NULL,'USD','yahoo','ASML','yahoo'),
('ASML_AS','ASML (Amsterdam)','stocks',1131.60000000,-5.7942,true,0.0100,5,1.1302,1,NULL,'EUR','yahoo','ASML.AS','yahoo'),
('AVGO','Broadcom Inc.','stocks',283.15000000,-5.9552,true,0.0100,5,0.1630,1,NULL,'USD','yahoo','AVGO','yahoo'),
('BA','The Boeing Company','stocks',162.25000000,-0.8191,true,0.0100,5,0.0858,1,NULL,'USD','yahoo','BA','yahoo'),
('BABA','Alibaba Group Holding Limited','stocks',83.14000000,-2.0269,true,0.0100,5,0.0490,1,NULL,'USD','yahoo','BABA','yahoo'),
('BAC','Bank of America Corporation','stocks',47.61500000,-1.9460,true,0.0100,5,0.0250,1,NULL,'USD','yahoo','BAC','yahoo'),
('BAS_DE','BASF','stocks',49.20000000,0.1017,true,0.0100,5,0.0428,1,NULL,'EUR','yahoo','BAS.DE','yahoo'),
('BAYN_DE','Bayer','stocks',50.68000000,-2.6134,true,0.0100,5,0.0405,1,NULL,'EUR','yahoo','BAYN.DE','yahoo'),
('BKNG','Booking Holdings Inc.','stocks',147.11500000,0.3239,true,0.0100,5,0.0741,1,NULL,'USD','yahoo','BKNG','yahoo'),
('BLK','BlackRock, Inc.','stocks',1113.24500000,-2.8607,true,0.0100,5,0.5738,1,NULL,'USD','yahoo','BLK','yahoo'),
('BMW_DE','BMW','stocks',55.24000000,3.7176,true,0.0100,5,0.0462,1,NULL,'EUR','yahoo','BMW.DE','yahoo'),
('BMY','Bristol-Myers Squibb Company','stocks',61.35000000,-1.0803,true,0.0100,5,0.0312,1,NULL,'USD','yahoo','BMY','yahoo'),
('BNP_PA','BNP Paribas','stocks',88.22000000,-2.2818,true,0.0100,5,0.0685,1,NULL,'EUR','yahoo','BNP.PA','yahoo'),
('BRK.B','Berkshire Hathaway Inc.','stocks',576.52500000,-0.1187,true,0.0100,5,0.2712,1,NULL,'USD','yahoo','BRK-B','yahoo'),
('C','Citigroup Inc.','stocks',111.07500000,-2.4374,true,0.0100,5,0.0613,1,NULL,'USD','yahoo','C','yahoo'),
('CAT','Caterpillar Inc.','stocks',520.59200000,-3.7064,true,0.0100,5,0.3114,1,NULL,'USD','yahoo','CAT','yahoo'),
('CB','Chubb Limited','stocks',381.68500000,1.6823,true,0.0100,5,0.1821,1,NULL,'USD','yahoo','CB','yahoo'),
('CI','The Cigna Group','stocks',272.83000000,-0.7891,true,0.0100,5,0.1491,1,NULL,'USD','yahoo','CI','yahoo'),
('CL','Colgate-Palmolive Company','stocks',100.03500000,0.8011,true,0.0100,5,0.0476,1,NULL,'USD','yahoo','CL','yahoo'),
('CMCSA','Comcast Corporation','stocks',25.82500000,1.7533,true,0.0100,5,0.0116,1,NULL,'USD','yahoo','CMCSA','yahoo'),
('CMG','Chipotle Mexican Grill, Inc.','stocks',37.39000000,0.9177,true,0.0100,5,0.0159,1,NULL,'USD','yahoo','CMG','yahoo'),
('COIN','Coinbase Global, Inc.','stocks',97.51000000,-4.7242,true,0.0100,5,0.0718,1,NULL,'USD','yahoo','COIN','yahoo'),
('COST','Costco Wholesale Corporation','stocks',1091.97000000,0.0238,true,0.0100,5,0.5061,1,NULL,'USD','yahoo','COST','yahoo'),
('CRM','Salesforce, Inc.','stocks',194.60500000,0.6960,true,0.0100,5,0.1146,1,NULL,'USD','yahoo','CRM','yahoo'),
('CRWD','CrowdStrike Holdings, Inc.','stocks',199.11300000,-5.5710,true,0.0100,5,0.1252,1,NULL,'USD','yahoo','CRWD','yahoo'),
('CS_PA','AXA','stocks',44.88000000,-0.9709,true,0.0100,5,0.0341,1,NULL,'EUR','yahoo','CS.PA','yahoo'),
('CSCO','Cisco Systems, Inc.','stocks',92.05500000,-2.0587,true,0.0100,5,0.0523,1,NULL,'USD','yahoo','CSCO','yahoo'),
('CVS','CVS Health Corporation','stocks',81.94000000,1.5491,true,0.0100,5,0.0451,1,NULL,'USD','yahoo','CVS','yahoo'),
('CVX','Chevron Corporation','stocks',210.05500000,0.6348,true,0.0100,5,0.1178,1,NULL,'USD','yahoo','CVX','yahoo'),
('DBK_DE','Deutsche Bank','stocks',29.07000000,-2.7759,true,0.0100,5,0.0241,1,NULL,'EUR','yahoo','DBK.DE','yahoo'),
('DDOG','Datadog, Inc.','stocks',151.90000000,-8.1509,true,0.0100,5,0.1176,1,NULL,'USD','yahoo','DDOG','yahoo'),
('DE','Deere & Company','stocks',627.05000000,2.1653,true,0.0100,5,0.3377,1,NULL,'USD','yahoo','DE','yahoo'),
('DELL','Dell Technologies Inc.','stocks',278.41000000,-5.7132,true,0.0100,5,0.2122,1,NULL,'USD','yahoo','DELL','yahoo'),
('DG','Dollar General Corporation','stocks',138.78000000,0.0938,true,0.0100,5,0.0662,1,NULL,'USD','yahoo','DG','yahoo'),
('DG_PA','Vinci','stocks',112.40000000,0.5817,true,0.0100,5,0.0869,1,NULL,'EUR','yahoo','DG.PA','yahoo'),
('DHL_DE','DHL Group','stocks',56.06000000,-0.4616,true,0.0100,5,0.0469,1,NULL,'EUR','yahoo','DHL.DE','yahoo'),
('DHR','Danaher Corporation','stocks',226.03500000,-1.3335,true,0.0100,5,0.1161,1,NULL,'USD','yahoo','DHR','yahoo'),
('DIS','The Walt Disney Company','stocks',122.98000000,0.3836,true,0.0100,5,0.0555,1,NULL,'USD','yahoo','DIS','yahoo'),
('DKNG','DraftKings Inc.','stocks',16.94600000,5.1893,true,0.0100,5,0.0105,1,NULL,'USD','yahoo','DKNG','yahoo'),
('DOCU','DocuSign, Inc.','stocks',79.94000000,-0.1249,true,0.0100,5,0.0411,1,NULL,'USD','yahoo','DOCU','yahoo'),
('DPZ','Domino''s Pizza, Inc.','stocks',360.98000000,1.2510,true,0.0100,5,0.1569,1,NULL,'USD','yahoo','DPZ','yahoo'),
('DTE_DE','Deutsche Telekom','stocks',26.83000000,0.0373,true,0.0100,5,0.0209,1,NULL,'EUR','yahoo','DTE.DE','yahoo'),
('DUK','Duke Energy Corporation','stocks',132.21000000,0.9545,true,0.0100,5,0.0637,1,NULL,'USD','yahoo','DUK','yahoo'),
('EBAY','eBay Inc.','stocks',114.65000000,0.7735,true,0.0100,5,0.0608,1,NULL,'USD','yahoo','EBAY','yahoo'),
('EL_PA','EssilorLuxottica','stocks',173.00000000,-1.2275,true,0.0100,5,0.1474,1,NULL,'EUR','yahoo','EL.PA','yahoo'),
('ENEL_MI','Enel','stocks',9.40300000,-0.2228,true,0.0100,5,0.0075,1,NULL,'EUR','yahoo','ENEL.MI','yahoo'),
('EOAN_DE','E.ON','stocks',18.61000000,0.1076,true,0.0100,5,0.0151,1,NULL,'EUR','yahoo','EOAN.DE','yahoo'),
('ETSY','Etsy, Inc.','stocks',79.27000000,-0.5395,true,0.0100,5,0.0445,1,NULL,'USD','yahoo','ETSY','yahoo'),
('F','Ford Motor Company','stocks',11.96000000,0.0837,true,0.0100,5,0.0061,1,NULL,'USD','yahoo','F','yahoo'),
('GE','GE Aerospace','stocks',311.73000000,-1.9809,true,0.0100,5,0.1509,1,NULL,'USD','yahoo','GE','yahoo'),
('GILD','Gilead Sciences, Inc.','stocks',176.79000000,-0.8413,true,0.0100,5,0.0853,1,NULL,'USD','yahoo','GILD','yahoo'),
('GIS','General Mills, Inc.','stocks',36.54000000,2.6693,true,0.0100,5,0.0171,1,NULL,'USD','yahoo','GIS','yahoo'),
('GLE_PA','Societe Generale','stocks',61.33000000,-2.9589,true,0.0100,5,0.0488,1,NULL,'EUR','yahoo','GLE.PA','yahoo'),
('GM','General Motors Company','stocks',82.76000000,0.5345,true,0.0100,5,0.0437,1,NULL,'USD','yahoo','GM','yahoo'),
('GOOGL','Alphabet Inc.','stocks',266.19000000,-4.6085,true,0.0100,100,0.0500,1,NULL,NULL,'yahoo','GOOGL','yahoo'),
('GS','The Goldman Sachs Group, Inc.','stocks',782.26000000,-2.9478,true,0.0100,5,0.4473,1,NULL,'USD','yahoo','GS','yahoo'),
('HD','The Home Depot, Inc.','stocks',357.27500000,1.0136,true,0.0100,5,0.1646,1,NULL,'USD','yahoo','HD','yahoo'),
('HON','Honeywell International Inc.','stocks',221.60500000,-1.4300,true,0.0100,5,0.1092,1,NULL,'USD','yahoo','HON','yahoo'),
('HOOD','Robinhood Markets, Inc.','stocks',62.16500000,-5.3085,true,0.0100,5,0.0425,1,NULL,'USD','yahoo','HOOD','yahoo'),
('HPQ','HP Inc.','stocks',31.01500000,11.0057,true,0.0100,5,0.0144,1,NULL,'USD','yahoo','HPQ','yahoo'),
('HSBC','HSBC Holdings plc','stocks',80.21000000,-2.2187,true,0.0100,5,0.0427,1,NULL,'USD','yahoo','HSBC','yahoo'),
('HSY','The Hershey Company','stocks',183.02000000,3.6588,true,0.0100,5,0.0828,1,NULL,'USD','yahoo','HSY','yahoo'),
('IBM','International Business Machines Corporation','stocks',241.30500000,2.4128,true,0.0100,5,0.1289,1,NULL,'USD','yahoo','IBM','yahoo'),
('IFX_DE','Infineon','stocks',40.89500000,-6.4937,true,0.0100,5,0.0404,1,NULL,'EUR','yahoo','IFX.DE','yahoo'),
('INGA_AS','ING Group','stocks',26.37500000,-3.0865,true,0.0100,5,0.0226,1,NULL,'EUR','yahoo','INGA.AS','yahoo'),
('INTC','Intel Corporation','stocks',49.98500000,-8.7865,true,0.0100,5,0.0329,1,NULL,'USD','yahoo','INTC','yahoo'),
('INTU','Intuit Inc.','stocks',275.69500000,-1.3331,true,0.0100,5,0.1705,1,NULL,'USD','yahoo','INTU','yahoo'),
('ISP_MI','Intesa Sanpaolo','stocks',5.49600000,-3.3415,true,0.0100,5,0.0047,1,NULL,'EUR','yahoo','ISP.MI','yahoo'),
('ISRG','Intuitive Surgical, Inc.','stocks',420.45000000,-3.2247,true,0.0100,5,0.2160,1,NULL,'USD','yahoo','ISRG','yahoo'),
('ITX_MC','Inditex','stocks',57.46000000,-1.4408,true,0.0100,5,0.0449,1,NULL,'EUR','yahoo','ITX.MC','yahoo'),
('JD','JD.com, Inc.','stocks',25.72500000,-0.0194,true,0.0100,5,0.0128,1,NULL,'USD','yahoo','JD','yahoo'),
('JNJ','Johnson & Johnson','stocks',273.86000000,-0.9405,true,0.0100,100,0.0300,1,NULL,NULL,'yahoo','JNJ','yahoo'),
('JPM','JPMorgan Chase & Co.','stocks',311.72700000,-1.6944,true,0.0100,100,0.0300,1,NULL,NULL,'yahoo','JPM','yahoo'),
('KER_PA','Kering','stocks',176.70000000,-1.8551,true,0.0100,5,0.1420,1,NULL,'EUR','yahoo','KER.PA','yahoo'),
('KHC','The Kraft Heinz Company','stocks',26.33500000,2.9918,true,0.0100,5,0.0122,1,NULL,'USD','yahoo','KHC','yahoo'),
('KMB','Kimberly-Clark Corporation','stocks',109.35900000,0.6063,true,0.0100,5,0.0540,1,NULL,'USD','yahoo','KMB','yahoo'),
('KO','The Coca-Cola Company','stocks',98.16500000,0.5583,true,0.0100,5,0.0470,1,NULL,'USD','yahoo','KO','yahoo'),
('LCID','Lucid Group, Inc.','stocks',2.51500000,-4.7348,true,0.0100,5,0.0015,1,NULL,'USD','yahoo','LCID','yahoo'),
('LHA_DE','Lufthansa','stocks',8.69400000,-0.5946,true,0.0100,5,0.0057,1,NULL,'EUR','yahoo','LHA.DE','yahoo'),
('LIN','Linde plc','stocks',519.06500000,0.4324,true,0.0100,5,0.2571,1,NULL,'USD','yahoo','LIN','yahoo'),
('LLY','Eli Lilly and Company','stocks',1375.73000000,-2.2634,true,0.0100,5,0.7088,1,NULL,'USD','yahoo','LLY','yahoo'),
('LMT','Lockheed Martin Corporation','stocks',592.09500000,0.9316,true,0.0100,5,0.3185,1,NULL,'USD','yahoo','LMT','yahoo'),
('LOW','Lowe''s Companies, Inc.','stocks',232.82000000,0.7704,true,0.0100,5,0.1045,1,NULL,'USD','yahoo','LOW','yahoo'),
('LULU','lululemon athletica inc.','stocks',105.00000000,-0.9901,true,0.0100,5,0.0536,1,NULL,'USD','yahoo','LULU','yahoo'),
('MA','Mastercard Incorporated','stocks',649.80500000,0.3653,true,0.0100,5,0.3190,1,NULL,'USD','yahoo','MA','yahoo'),
('MARA','MARA Holdings, Inc.','stocks',5.22500000,-3.4196,true,0.0100,5,0.0034,1,NULL,'USD','yahoo','MARA','yahoo'),
('MBG_DE','Mercedes-Benz','stocks',37.54000000,0.4818,true,0.0100,5,0.0325,1,NULL,'EUR','yahoo','MBG.DE','yahoo'),
('MC_PA','LVMH','stocks',391.00000000,-0.9374,true,0.0100,5,0.3096,1,NULL,'EUR','yahoo','MC.PA','yahoo'),
('MCD','McDonald''s Corporation','stocks',285.42000000,1.6815,true,0.0100,5,0.1291,1,NULL,'USD','yahoo','MCD','yahoo'),
('MDB','MongoDB, Inc.','stocks',302.35000000,-1.9935,true,0.0100,5,0.1765,1,NULL,'USD','yahoo','MDB','yahoo'),
('MDLZ','Mondelez International, Inc.','stocks',67.88500000,1.3058,true,0.0100,5,0.0325,1,NULL,'USD','yahoo','MDLZ','yahoo'),
('MDT','Medtronic plc','stocks',95.77000000,-0.3745,true,0.0100,5,0.0483,1,NULL,'USD','yahoo','MDT','yahoo'),
('META','Meta Platforms Inc.','stocks',585.57500000,-0.7197,true,0.0100,100,0.0500,1,NULL,NULL,'yahoo','META','yahoo'),
('MO','Altria Group, Inc.','stocks',76.29500000,1.9714,true,0.0100,5,0.0390,1,NULL,'USD','yahoo','MO','yahoo'),
('MRK','Merck & Co., Inc.','stocks',138.71000000,-2.0202,true,0.0100,5,0.0748,1,NULL,'USD','yahoo','MRK','yahoo'),
('MRVL','Marvell Technology, Inc.','stocks',119.70500000,-9.0180,true,0.0100,5,0.0982,1,NULL,'USD','yahoo','MRVL','yahoo'),
('MS','Morgan Stanley','stocks',164.57000000,-2.5001,true,0.0100,5,0.0922,1,NULL,'USD','yahoo','MS','yahoo'),
('MSFT','Microsoft Corporation','stocks',482.76000000,-2.6949,true,0.0100,100,0.0200,1,NULL,NULL,'yahoo','MSFT','yahoo'),
('MSTR','Strategy Inc','stocks',72.10000000,-7.0277,true,0.0100,5,0.0653,1,NULL,'USD','yahoo','MSTR','yahoo'),
('MU','Micron Technology, Inc.','stocks',552.73000000,-12.2752,true,0.0100,5,0.4424,1,NULL,'USD','yahoo','MU','yahoo'),
('MUV2_DE','Munich Re','stocks',585.00000000,-0.3067,true,0.0100,5,0.4536,1,NULL,'EUR','yahoo','MUV2.DE','yahoo'),
('NEE','NextEra Energy, Inc.','stocks',85.00000000,0.4966,true,0.0100,5,0.0419,1,NULL,'USD','yahoo','NEE','yahoo'),
('NESN_SW','Nestle','stocks',87.15000000,1.0083,true,0.0100,5,0.0678,1,NULL,'CHF','yahoo','NESN.SW','yahoo'),
('NET','Cloudflare, Inc.','stocks',270.26000000,-5.9278,true,0.0100,5,0.1404,1,NULL,'USD','yahoo','NET','yahoo'),
('NFLX','Netflix Inc.','stocks',57.77500000,-1.8600,true,0.0100,100,0.1000,1,NULL,NULL,'yahoo','NFLX','yahoo'),
('NIO','NIO Inc.','stocks',2.58500000,0.1938,true,0.0100,5,0.0016,1,NULL,'USD','yahoo','NIO','yahoo'),
('NKE','NIKE, Inc.','stocks',36.05500000,0.8531,true,0.0100,5,0.0193,1,NULL,'USD','yahoo','NKE','yahoo'),
('NOVN_SW','Novartis','stocks',128.10000000,-0.3888,true,0.0100,5,0.1070,1,NULL,'CHF','yahoo','NOVN.SW','yahoo'),
('NOW','ServiceNow, Inc.','stocks',90.44600000,-1.4105,true,0.0100,5,0.0526,1,NULL,'USD','yahoo','NOW','yahoo'),
('NVDA','NVIDIA Corporation','stocks',142.19500000,-8.4856,true,0.0100,100,0.2000,1,NULL,NULL,'yahoo','NVDA','yahoo'),
('NVO','Novo Nordisk A/S','stocks',40.36000000,0.1240,true,0.0100,5,0.0200,1,NULL,'USD','yahoo','NVO','yahoo'),
('OR_PA','L''Oreal','stocks',442.00000000,0.2495,true,0.0100,5,0.3496,1,NULL,'EUR','yahoo','OR.PA','yahoo'),
('ORCL','Oracle Corporation','stocks',100.93000000,-7.8265,true,0.0100,5,0.0653,1,NULL,'USD','yahoo','ORCL','yahoo'),
('PAH3_DE','Porsche SE','stocks',22.97000000,1.6822,true,0.0100,5,0.0205,1,NULL,'EUR','yahoo','PAH3.DE','yahoo'),
('PANW','Palo Alto Networks, Inc.','stocks',340.80000000,-3.4534,true,0.0100,5,0.1829,1,NULL,'USD','yahoo','PANW','yahoo'),
('PDD','PDD Holdings Inc.','stocks',86.47000000,-0.8599,true,0.0100,5,0.0393,1,NULL,'USD','yahoo','PDD','yahoo'),
('PEP','PepsiCo, Inc.','stocks',144.60000000,1.3457,true,0.0100,5,0.0687,1,NULL,'USD','yahoo','PEP','yahoo'),
('PG','Procter & Gamble','stocks',173.65000000,0.6842,true,0.0100,100,0.0300,1,NULL,NULL,'yahoo','PG','yahoo'),
('PGR','The Progressive Corporation','stocks',238.22500000,1.0799,true,0.0100,5,0.1156,1,NULL,'USD','yahoo','PGR','yahoo'),
('PINS','Pinterest, Inc.','stocks',18.96000000,2.4865,true,0.0100,5,0.0097,1,NULL,'USD','yahoo','PINS','yahoo'),
('PLD','Prologis, Inc.','stocks',126.44500000,-0.6872,true,0.0100,5,0.0640,1,NULL,'USD','yahoo','PLD','yahoo'),
('PLTR','Palantir Technologies Inc.','stocks',156.80000000,-2.7175,true,0.0100,5,0.0921,1,NULL,'USD','yahoo','PLTR','yahoo'),
('PM','Philip Morris International Inc.','stocks',184.47500000,0.2854,true,0.0100,5,0.1044,1,NULL,'USD','yahoo','PM','yahoo'),
('PYPL','PayPal Holdings, Inc.','stocks',56.31000000,0.2492,true,0.0100,5,0.0285,1,NULL,'USD','yahoo','PYPL','yahoo'),
('QCOM','QUALCOMM Incorporated','stocks',159.51000000,-3.3038,true,0.0100,5,0.0824,1,NULL,'USD','yahoo','QCOM','yahoo'),
('RACE_MI','Ferrari','stocks',365.70000000,1.2458,true,0.0100,5,0.2841,1,NULL,'EUR','yahoo','RACE.MI','yahoo'),
('RBLX','Roblox Corporation','stocks',53.39000000,-0.1870,true,0.0100,5,0.0215,1,NULL,'USD','yahoo','RBLX','yahoo'),
('REGN','Regeneron Pharmaceuticals, Inc.','stocks',974.44500000,-1.2810,true,0.0100,5,0.4639,1,NULL,'USD','yahoo','REGN','yahoo'),
('RHM_DE','Rheinmetall','stocks',735.80000000,0.1770,true,0.0100,5,0.8301,1,NULL,'EUR','yahoo','RHM.DE','yahoo'),
('RI_PA','Pernod Ricard','stocks',70.10000000,0.5162,true,0.0100,5,0.0541,1,NULL,'EUR','yahoo','RI.PA','yahoo'),
('RIOT','Riot Platforms, Inc.','stocks',15.78500000,-3.3966,true,0.0100,5,0.0064,1,NULL,'USD','yahoo','RIOT','yahoo'),
('RIVN','Rivian Automotive, Inc.','stocks',11.17500000,-1.5419,true,0.0100,5,0.0061,1,NULL,'USD','yahoo','RIVN','yahoo'),
('RMS_PA','Hermes','stocks',1252.00000000,0.0799,true,0.0100,5,1.0348,1,NULL,'EUR','yahoo','RMS.PA','yahoo'),
('RNO_PA','Renault','stocks',27.37000000,2.2795,true,0.0100,5,0.0221,1,NULL,'EUR','yahoo','RNO.PA','yahoo'),
('ROKU','Roku, Inc.','stocks',160.52000000,0.0935,true,0.0100,5,0.0776,1,NULL,'USD','yahoo','ROKU','yahoo'),
('ROST','Ross Stores, Inc.','stocks',222.94000000,-1.4325,true,0.0100,5,0.1141,1,NULL,'USD','yahoo','ROST','yahoo'),
('RTX','RTX Corporation','stocks',193.96100000,-0.7009,true,0.0100,5,0.0999,1,NULL,'USD','yahoo','RTX','yahoo'),
('SAN_MC','Banco Santander','stocks',10.02800000,-3.9648,true,0.0100,5,0.0081,1,NULL,'EUR','yahoo','SAN.MC','yahoo'),
('SAN_PA','Sanofi','stocks',98.16000000,4.8942,true,0.0100,5,0.0638,1,NULL,'EUR','yahoo','SAN.PA','yahoo'),
('SAP','SAP SE','stocks',209.65000000,0.4311,true,0.0100,5,0.1175,1,NULL,'USD','yahoo','SAP','yahoo'),
('SAP_DE','SAP SE (Frankfurt)','stocks',189.82000000,-0.1368,true,0.0100,5,0.1690,1,NULL,'EUR','yahoo','SAP.DE','yahoo'),
('SBUX','Starbucks Corporation','stocks',106.56000000,0.1692,true,0.0100,5,0.0518,1,NULL,'USD','yahoo','SBUX','yahoo'),
('SCHW','The Charles Schwab Corporation','stocks',92.70000000,-1.2885,true,0.0100,5,0.0440,1,NULL,'USD','yahoo','SCHW','yahoo'),
('SHOP','Shopify Inc.','stocks',128.31000000,-3.0232,true,0.0100,5,0.0787,1,NULL,'USD','yahoo','SHOP','yahoo'),
('SIE_DE','Siemens','stocks',245.50000000,-3.5932,true,0.0100,5,0.2125,1,NULL,'EUR','yahoo','SIE.DE','yahoo'),
('SMCI','Super Micro Computer, Inc.','stocks',21.57000000,-4.6419,true,0.0100,5,0.0165,1,NULL,'USD','yahoo','SMCI','yahoo'),
('SNAP','Snap Inc.','stocks',4.84000000,-1.0225,true,0.0100,5,0.0027,1,NULL,'USD','yahoo','SNAP','yahoo'),
('SNOW','Snowflake Inc.','stocks',257.76000000,-4.9172,true,0.0100,5,0.1530,1,NULL,'USD','yahoo','SNOW','yahoo'),
('SO','The Southern Company','stocks',95.02000000,0.9670,true,0.0100,5,0.0469,1,NULL,'USD','yahoo','SO','yahoo'),
('SOFI','SoFi Technologies, Inc.','stocks',12.46000000,-3.1104,true,0.0100,5,0.0084,1,NULL,'USD','yahoo','SOFI','yahoo'),
('SONY','Sony Group Corporation','stocks',28.29500000,1.8172,true,0.0100,5,0.0127,1,NULL,'USD','yahoo','SONY','yahoo'),
('SPGI','S&P Global Inc.','stocks',456.01000000,0.3985,true,0.0100,5,0.2333,1,NULL,'USD','yahoo','SPGI','yahoo'),
('SPOT','Spotify Technology S.A.','stocks',605.73500000,0.9996,true,0.0100,5,0.2967,1,NULL,'USD','yahoo','SPOT','yahoo'),
('SU_PA','Schneider Electric','stocks',216.65000000,-4.1796,true,0.0100,5,0.1900,1,NULL,'EUR','yahoo','SU.PA','yahoo'),
('SYK','Stryker Corporation','stocks',329.06000000,1.5367,true,0.0100,5,0.1459,1,NULL,'USD','yahoo','SYK','yahoo'),
('T','AT&T Inc.','stocks',23.20100000,1.4030,true,0.0100,5,0.0107,1,NULL,'USD','yahoo','T','yahoo'),
('TGT','Target Corporation','stocks',172.40500000,-2.0760,true,0.0100,5,0.0772,1,NULL,'USD','yahoo','TGT','yahoo'),
('TJX','The TJX Companies, Inc.','stocks',145.61500000,1.2199,true,0.0100,5,0.0702,1,NULL,'USD','yahoo','TJX','yahoo'),
('TM','Toyota Motor Corporation','stocks',213.53000000,1.6955,true,0.0100,5,0.0979,1,NULL,'USD','yahoo','TM','yahoo'),
('TMO','Thermo Fisher Scientific Inc.','stocks',675.36000000,-2.9125,true,0.0100,5,0.3485,1,NULL,'USD','yahoo','TMO','yahoo'),
('TSLA','Tesla Inc.','stocks',365.47000000,-4.9938,true,0.0100,100,0.1000,1,NULL,NULL,'yahoo','TSLA','yahoo'),
('TSM','Taiwan Semiconductor Manufacturing','stocks',324.79500000,-6.9888,true,0.0100,5,0.2031,1,NULL,'USD','yahoo','TSM','yahoo'),
('TTD','The Trade Desk, Inc.','stocks',14.24500000,1.2438,true,0.0100,5,0.0061,1,NULL,'USD','yahoo','TTD','yahoo'),
('TTE_PA','TotalEnergies','stocks',77.28000000,-0.5149,true,0.0100,5,0.0683,1,NULL,'EUR','yahoo','TTE.PA','yahoo'),
('TXN','Texas Instruments Incorporated','stocks',255.54500000,-1.1202,true,0.0100,5,0.1504,1,NULL,'USD','yahoo','TXN','yahoo'),
('UBER','Uber Technologies, Inc.','stocks',65.04000000,0.5255,true,0.0100,5,0.0326,1,NULL,'USD','yahoo','UBER','yahoo'),
('UBSG_SW','UBS','stocks',36.80000000,-1.3934,true,0.0100,5,0.0314,1,NULL,'CHF','yahoo','UBSG.SW','yahoo'),
('UNH','UnitedHealth Group Incorporated','stocks',343.29500000,0.4139,true,0.0100,5,0.2035,1,NULL,'USD','yahoo','UNH','yahoo'),
('UPS','United Parcel Service, Inc.','stocks',110.71000000,-0.1083,true,0.0100,5,0.0541,1,NULL,'USD','yahoo','UPS','yahoo'),
('V','Visa Inc.','stocks',418.85000000,0.4967,true,0.0100,100,0.0300,1,NULL,NULL,'yahoo','V','yahoo'),
('VOW3_DE','Volkswagen','stocks',65.24000000,4.6183,true,0.0100,5,0.0557,1,NULL,'EUR','yahoo','VOW3.DE','yahoo'),
('VRTX','Vertex Pharmaceuticals Incorporated','stocks',556.67500000,-1.2848,true,0.0100,5,0.2794,1,NULL,'USD','yahoo','VRTX','yahoo'),
('VZ','Verizon Communications Inc.','stocks',47.60500000,0.9436,true,0.0100,5,0.0224,1,NULL,'USD','yahoo','VZ','yahoo'),
('WBD','Warner Bros. Discovery Inc','stocks',30.95000000,0.0000,true,0.0100,5,0.0155,1,NULL,'USD','yahoo','WBD','yahoo'),
('WFC','Wells Fargo & Company','stocks',79.67000000,-1.8722,true,0.0100,5,0.0417,1,NULL,'USD','yahoo','WFC','yahoo'),
('WMT','Walmart Inc.','stocks',132.07000000,-0.1814,true,0.0100,100,0.0200,1,NULL,NULL,'yahoo','WMT','yahoo'),
('XOM','Exxon Mobil Corporation','stocks',158.23000000,0.0000,true,0.0100,5,0.0936,1,NULL,'USD','yahoo','XOM','yahoo'),
('YUM','Yum! Brands, Inc.','stocks',166.45500000,0.0752,true,0.0100,5,0.0777,1,NULL,'USD','yahoo','YUM','yahoo'),
('ZM','Zoom Communications, Inc.','stocks',88.51500000,0.1301,true,0.0100,5,0.0478,1,NULL,'USD','yahoo','ZM','yahoo'),
('ZTS','Zoetis Inc.','stocks',82.12000000,0.7978,true,0.0100,5,0.0399,1,NULL,'USD','yahoo','ZTS','yahoo');

COMMIT;

SELECT 'SETUP COMPLETE: ' || (SELECT count(*) FROM public.assets) || ' markets loaded' AS result;
