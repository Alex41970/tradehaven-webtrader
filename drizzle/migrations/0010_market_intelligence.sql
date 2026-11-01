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