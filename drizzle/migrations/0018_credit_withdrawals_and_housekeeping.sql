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