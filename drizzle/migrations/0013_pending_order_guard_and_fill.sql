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