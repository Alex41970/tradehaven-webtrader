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