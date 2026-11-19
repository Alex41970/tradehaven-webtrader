ALTER TABLE public.trade_orders ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.trade_orders ADD COLUMN IF NOT EXISTS filled_trade_id uuid;

CREATE OR REPLACE FUNCTION public.is_market_open(_symbol text, _category text, _ts timestamptz DEFAULT now())
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  tz text; o int; c int; loc timestamp; dow int; m int;
BEGIN
  IF _category = 'crypto' THEN RETURN true; END IF;
  IF _category IN ('forex','commodities') THEN
    loc := _ts AT TIME ZONE 'America/New_York';
    dow := extract(dow from loc)::int; m := extract(hour from loc)::int*60 + extract(minute from loc)::int;
    o := CASE WHEN _category = 'forex' THEN 17*60 ELSE 18*60 END;
    IF dow = 6 THEN RETURN false; END IF;
    IF dow = 0 THEN RETURN m >= o; END IF;
    IF dow = 5 THEN RETURN m < 17*60; END IF;
    IF _category = 'commodities' AND m >= 17*60 AND m < 18*60 THEN RETURN false; END IF;
    RETURN true;
  END IF;
  -- daily exchange sessions
  SELECT x.tz, x.o, x.c INTO tz, o, c FROM (VALUES
    ('UK100','Europe/London',480,990),
    ('GER40','Europe/Berlin',540,1050),('FRA40','Europe/Paris',540,1050),('EU50','Europe/Berlin',540,1050),
    ('ITA40','Europe/Rome',540,1050),('ESP35','Europe/Madrid',540,1050),('NED25','Europe/Amsterdam',540,1050),
    ('SUI20','Europe/Zurich',540,1050),('JPN225','Asia/Tokyo',540,930),('HK50','Asia/Hong_Kong',570,960),
    ('CHINA50','Asia/Shanghai',570,900),('AUS200','Australia/Sydney',600,960),('IND50','Asia/Kolkata',555,930),
    ('KOR200','Asia/Seoul',540,930),('CAN60','America/Toronto',570,960),('BRA50','America/Sao_Paulo',600,1020)
  ) AS x(sym,tz,o,c) WHERE x.sym = _symbol;
  IF tz IS NULL THEN tz := 'America/New_York'; o := 570; c := 960; END IF;
  loc := _ts AT TIME ZONE tz;
  dow := extract(dow from loc)::int; m := extract(hour from loc)::int*60 + extract(minute from loc)::int;
  RETURN dow BETWEEN 1 AND 5 AND m >= o AND m < c;
END $$;
GRANT EXECUTE ON FUNCTION public.is_market_open(text,text,timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_trade_open_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_market numeric; v_contract numeric; v_available numeric; v_cat text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'open' THEN RETURN NEW; END IF;
  SELECT price, COALESCE(NULLIF(contract_size, 0), 1), category INTO v_market, v_contract, v_cat FROM assets WHERE id = NEW.asset_id;
  IF current_user IN ('authenticated','service_role') AND NOT is_market_open(NEW.symbol, v_cat, now()) THEN
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
  RETURN OLD #= hstore(ARRAY['status','cancel_reason','updated_at'], ARRAY['cancelled','Cancelled by you', now()::text]);
END $$;
