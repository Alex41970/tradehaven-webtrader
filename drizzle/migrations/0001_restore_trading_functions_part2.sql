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