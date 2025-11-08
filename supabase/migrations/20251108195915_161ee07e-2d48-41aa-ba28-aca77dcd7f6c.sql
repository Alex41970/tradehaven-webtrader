-- Harden admin balance modification RPC with definitive return payload and transaction IDs
-- Drop existing variants for clean replacement
DROP FUNCTION IF EXISTS public.admin_modify_user_balance(uuid, uuid, numeric, text);
DROP FUNCTION IF EXISTS public.admin_modify_user_balance(uuid, uuid, numeric, text, text);

-- Recreate function with robust behavior and logging
CREATE OR REPLACE FUNCTION public.admin_modify_user_balance(
  _admin_id uuid,
  _user_id uuid,
  _amount numeric,
  _operation text,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_balance NUMERIC;
  _new_balance NUMERIC;
  _delta NUMERIC;
  _deposit_id uuid;
  _withdrawal_id uuid;
  _rowcount INTEGER;
BEGIN
  -- Verify admin has access to this user or is super admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _user_id
  ) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Load current balance
  SELECT balance INTO _current_balance
  FROM user_profiles
  WHERE user_id = _user_id;

  IF _current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF _operation = 'set' THEN
    _delta := _amount - _current_balance;

    UPDATE user_profiles
    SET balance = _amount,
        equity = _amount,
        available_margin = GREATEST(_amount - used_margin, 0),
        updated_at = now()
    WHERE user_id = _user_id;

    GET DIAGNOSTICS _rowcount = ROW_COUNT;
    IF _rowcount = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profile update failed');
    END IF;

    _new_balance := _amount;

    IF _delta > 0 THEN
      INSERT INTO deposit_requests (
        user_id, amount, status, deposit_type, processed_by_admin, processed_at, admin_notes
      ) VALUES (
        _user_id, ABS(_delta), 'approved', 'admin_adjustment', _admin_id, now(),
        COALESCE(_reason, format('Balance set from %s to %s by admin', _current_balance, _amount))
      ) RETURNING id INTO _deposit_id;
    ELSIF _delta < 0 THEN
      INSERT INTO withdrawal_requests (
        user_id, amount, status, withdrawal_type, processed_by_admin, processed_at, admin_notes
      ) VALUES (
        _user_id, ABS(_delta), 'approved', 'admin_adjustment', _admin_id, now(),
        COALESCE(_reason, format('Balance set from %s to %s by admin', _current_balance, _amount))
      ) RETURNING id INTO _withdrawal_id;
    END IF;

  ELSIF _operation = 'add' THEN
    UPDATE user_profiles
    SET balance = balance + _amount,
        equity = equity + _amount,
        available_margin = available_margin + _amount,
        updated_at = now()
    WHERE user_id = _user_id;

    GET DIAGNOSTICS _rowcount = ROW_COUNT;
    IF _rowcount = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profile update failed');
    END IF;

    _new_balance := _current_balance + _amount;

    INSERT INTO deposit_requests (
      user_id, amount, status, deposit_type, processed_by_admin, processed_at, admin_notes
    ) VALUES (
      _user_id, _amount, 'approved', 'admin_adjustment', _admin_id, now(),
      COALESCE(_reason, 'Balance added by admin')
    ) RETURNING id INTO _deposit_id;

  ELSIF _operation = 'deduct' THEN
    UPDATE user_profiles
    SET balance = GREATEST(balance - _amount, 0),
        equity = GREATEST(equity - _amount, 0),
        available_margin = GREATEST(available_margin - _amount, 0),
        updated_at = now()
    WHERE user_id = _user_id;

    GET DIAGNOSTICS _rowcount = ROW_COUNT;
    IF _rowcount = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profile update failed');
    END IF;

    _new_balance := GREATEST(_current_balance - _amount, 0);

    INSERT INTO withdrawal_requests (
      user_id, amount, status, withdrawal_type, processed_by_admin, processed_at, admin_notes
    ) VALUES (
      _user_id, _amount, 'approved', 'admin_adjustment', _admin_id, now(),
      COALESCE(_reason, 'Balance deducted by admin')
    ) RETURNING id INTO _withdrawal_id;

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid operation');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Balance %s successfully', _operation),
    'previous_balance', _current_balance,
    'new_balance', _new_balance,
    'created_deposit_id', _deposit_id,
    'created_withdrawal_id', _withdrawal_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;