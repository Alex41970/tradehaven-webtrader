CREATE OR REPLACE FUNCTION public.enforce_trade_open_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_market numeric; v_contract numeric; v_available numeric; v_cat text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'open' THEN RETURN NEW; END IF;
  SELECT price, COALESCE(NULLIF(contract_size, 0), 1), category INTO v_market, v_contract, v_cat FROM assets WHERE id = NEW.asset_id;
  IF NEW.parent_order_id IS NULL
     AND NOT is_market_open(NEW.symbol, v_cat, now())
     AND NOT (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))) THEN
    RAISE EXCEPTION 'Market closed. You can place a pending order instead.';
  END IF;
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
$function$;