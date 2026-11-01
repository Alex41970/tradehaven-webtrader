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