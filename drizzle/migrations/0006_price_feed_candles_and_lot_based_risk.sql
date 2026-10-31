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