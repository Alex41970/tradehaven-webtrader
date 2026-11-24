-- =====================================================================
-- CREDIT: company money a client can trade with but never withdraw
-- =====================================================================

-- 1. Credit pot on the account ---------------------------------------
ALTER TABLE public.user_profiles ADD COLUMN credit numeric NOT NULL DEFAULT 0;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_credit_nonnegative CHECK (credit >= 0);

-- 2. Ledger of every credit movement ----------------------------------
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'credit_in', 'credit_out', 'loss_cover', 'loss_cover_reversal',
    'negative_balance_reset', 'negative_balance_reset_reversal', 'account_reset')),
  amount numeric NOT NULL DEFAULT 0,          -- signed change in credit
  balance_change numeric NOT NULL DEFAULT 0,  -- signed change in balance booked by this entry
  credit_after numeric NOT NULL,
  balance_after numeric NOT NULL,
  reason text,
  performed_by uuid,                          -- admin who did it; NULL = automatic
  trade_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_transactions_user_created ON public.credit_transactions (user_id, created_at DESC);

GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users and their admins can view credit history"
ON public.credit_transactions FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.admin_user_relationships r
    WHERE r.admin_id = auth.uid() AND r.user_id = credit_transactions.user_id)
);
-- No insert/update/delete policies: only trusted database functions write the ledger.

-- 3. Live totals of a client's open positions --------------------------
CREATE OR REPLACE FUNCTION public.account_open_totals(_user_id uuid)
RETURNS TABLE(used numeric, floating numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(sum(t.margin_used), 0),
         COALESCE(sum(CASE WHEN a.price > 0
                           THEN round(calc_trade_pnl(t.trade_type, t.amount, a.contract_size, t.open_price, a.price), 2)
                           ELSE COALESCE(t.pnl, 0) END), 0)
  FROM trades t JOIN assets a ON a.id = t.asset_id
  WHERE t.user_id = _user_id AND t.status = 'open';
$$;
REVOKE ALL ON FUNCTION public.account_open_totals(uuid) FROM PUBLIC, anon, authenticated;

-- 4. One place that derives equity / margin figures --------------------
--    equity = balance + credit + open P&L ; free margin = equity - margin in use
CREATE OR REPLACE FUNCTION public.validate_user_balance()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE o RECORD;
BEGIN
  NEW.balance := COALESCE(NEW.balance, 0);
  NEW.credit := COALESCE(NEW.credit, 0);
  IF NEW.credit < 0 THEN
    RAISE EXCEPTION 'Credit cannot be negative';
  END IF;
  SELECT * INTO o FROM account_open_totals(NEW.user_id);
  NEW.used_margin := o.used;
  NEW.equity := NEW.balance + NEW.credit + o.floating;
  NEW.available_margin := GREATEST(NEW.equity - NEW.used_margin, 0);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_user_balance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS check_margin_before_update ON public.user_profiles;
DROP TRIGGER IF EXISTS final_balance_validation_trigger ON public.user_profiles;
DROP FUNCTION IF EXISTS public.prevent_negative_margin();

-- 5. Signed-in people can never write money fields directly -------------
CREATE OR REPLACE FUNCTION public.prevent_user_financial_updates()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_admin boolean;
BEGIN
  -- Only direct edits made through the API as a signed-in person are restricted.
  -- Trusted database functions run as the function owner and pass through.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  v_admin := public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role);
  IF TG_OP = 'INSERT' THEN
    NEW.balance := 0; NEW.credit := 0; NEW.equity := 0; NEW.used_margin := 0; NEW.available_margin := 0;
    NEW.account_status := 'active'; NEW.grace_period_until := NULL; NEW.frozen_at := NULL; NEW.frozen_reason := NULL;
    IF NOT v_admin THEN
      NEW.admin_id := NULL; NEW.promo_code_used := NULL; NEW.assignment_method := 'manual';
    END IF;
    RETURN NEW;
  END IF;
  -- Credit only changes through the credit functions, so the ledger is always complete
  NEW.credit := OLD.credit;
  IF auth.uid() = NEW.user_id AND NOT v_admin THEN
    NEW.balance := OLD.balance;
    NEW.equity := OLD.equity;
    NEW.used_margin := OLD.used_margin;
    NEW.available_margin := OLD.available_margin;
    NEW.admin_id := OLD.admin_id;
    NEW.promo_code_used := OLD.promo_code_used;
    NEW.assignment_method := OLD.assignment_method;
    NEW.assigned_at := OLD.assigned_at;
    NEW.account_status := OLD.account_status;
    NEW.grace_period_until := OLD.grace_period_until;
    NEW.frozen_at := OLD.frozen_at;
    NEW.frozen_reason := OLD.frozen_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_user_financial_inserts_trigger ON public.user_profiles;
CREATE TRIGGER prevent_user_financial_inserts_trigger
BEFORE INSERT ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_user_financial_updates();

-- 6. The flat-account rule ---------------------------------------------
--    Credit covers a negative balance only when no position is open; what is
--    left after that follows the admin's negative-balance setting.
CREATE OR REPLACE FUNCTION public.settle_account(_user_id uuid, _trade_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p RECORD;
  v_cover numeric := 0;
  v_reset numeric := 0;
  v_neg boolean;
  v_flat boolean;
BEGIN
  SELECT * INTO p FROM user_profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('credit_used', 0, 'negative_balance_cleared', 0);
  END IF;
  v_flat := NOT EXISTS (SELECT 1 FROM trades WHERE user_id = _user_id AND status = 'open');

  IF v_flat AND p.balance < 0 THEN
    IF p.credit > 0 THEN
      v_cover := LEAST(p.credit, -p.balance);
      INSERT INTO credit_transactions (user_id, type, amount, balance_change, credit_after, balance_after, reason, trade_id)
      VALUES (_user_id, 'loss_cover', -v_cover, v_cover, p.credit - v_cover, p.balance + v_cover,
              'Credit used to cover trading losses', _trade_id);
    END IF;
    IF p.balance + v_cover < 0 THEN
      SELECT neg INTO v_neg FROM get_risk_settings(p.admin_id);
      IF NOT COALESCE(v_neg, false) THEN
        v_reset := -(p.balance + v_cover);
        INSERT INTO credit_transactions (user_id, type, amount, balance_change, credit_after, balance_after, reason, trade_id)
        VALUES (_user_id, 'negative_balance_reset', 0, v_reset, p.credit - v_cover, 0,
                'Negative balance cleared', _trade_id);
      END IF;
    END IF;
  END IF;

  UPDATE user_profiles SET
    balance = p.balance + v_cover + v_reset,
    credit = p.credit - v_cover,
    account_status = CASE WHEN v_flat AND account_status IN ('margin_call', 'grace') THEN 'active' ELSE account_status END,
    grace_period_until = CASE WHEN v_flat THEN NULL ELSE grace_period_until END,
    updated_at = now()
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('credit_used', v_cover, 'negative_balance_cleared', v_reset);
END;
$$;
REVOKE ALL ON FUNCTION public.settle_account(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 7. What a client may withdraw ------------------------------------------
--    balance - margin in use - open losses; credit never counts
CREATE OR REPLACE FUNCTION public.get_withdrawable_amount(_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_bal numeric; o RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT has_role(auth.uid(), 'super_admin'::app_role)
     AND NOT EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = auth.uid() AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT balance INTO v_bal FROM user_profiles WHERE user_id = _user_id;
  IF v_bal IS NULL THEN
    RETURN 0;
  END IF;
  SELECT * INTO o FROM account_open_totals(_user_id);
  RETURN GREATEST(trunc(LEAST(v_bal, v_bal - o.used + LEAST(o.floating, 0)), 2), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.get_withdrawable_amount(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_withdrawable_amount(uuid) TO authenticated, service_role;