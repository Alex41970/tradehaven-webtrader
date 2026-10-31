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