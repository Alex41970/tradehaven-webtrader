CREATE OR REPLACE FUNCTION public.prevent_user_financial_updates() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only block direct edits made by a signed-in user through the API.
  -- Updates performed inside trusted database functions run as the function owner and are allowed.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() = NEW.user_id AND NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    NEW.balance = OLD.balance;
    NEW.equity = OLD.equity;
    NEW.used_margin = OLD.used_margin;
    NEW.available_margin = OLD.available_margin;
    NEW.admin_id = OLD.admin_id;
    NEW.promo_code_used = OLD.promo_code_used;
    NEW.assignment_method = OLD.assignment_method;
    NEW.assigned_at = OLD.assigned_at;
    NEW.account_status = OLD.account_status;
    NEW.grace_period_until = OLD.grace_period_until;
    NEW.frozen_at = OLD.frozen_at;
    NEW.frozen_reason = OLD.frozen_reason;
  END IF;
  RETURN NEW;
END;
$$;