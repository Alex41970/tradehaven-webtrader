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