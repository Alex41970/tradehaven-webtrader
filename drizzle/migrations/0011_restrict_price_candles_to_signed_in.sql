DROP POLICY IF EXISTS "Anyone can read candles" ON public.price_candles;
REVOKE SELECT ON public.price_candles FROM anon;
GRANT SELECT ON public.price_candles TO authenticated;
CREATE POLICY "Signed-in users can read candles" ON public.price_candles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);