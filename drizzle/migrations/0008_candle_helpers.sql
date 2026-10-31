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