-- Drop and recreate admin_modify_user_balance with transaction logging
DROP FUNCTION IF EXISTS public.admin_modify_user_balance(uuid, uuid, numeric, text);

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
AS $function$
DECLARE
  _current_balance NUMERIC;
  _delta NUMERIC;
  _transaction_amount NUMERIC;
BEGIN
  -- Verify admin has access to this user
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _user_id
  ) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Get current balance
  SELECT balance INTO _current_balance
  FROM user_profiles
  WHERE user_id = _user_id;
  
  IF _current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  -- Perform the balance operation
  IF _operation = 'set' THEN
    -- Calculate delta for transaction logging
    _delta := _amount - _current_balance;
    _transaction_amount := ABS(_delta);
    
    -- Update balance
    UPDATE user_profiles
    SET balance = _amount,
        equity = _amount,
        available_margin = GREATEST(_amount - used_margin, 0),
        updated_at = now()
    WHERE user_id = _user_id;
    
    -- Log transaction based on delta
    IF _delta > 0 THEN
      -- Balance increased - log as deposit
      INSERT INTO deposit_requests (
        user_id,
        amount,
        status,
        deposit_type,
        processed_by_admin,
        processed_at,
        admin_notes
      ) VALUES (
        _user_id,
        _transaction_amount,
        'approved',
        'admin_adjustment',
        _admin_id,
        now(),
        COALESCE(_reason, format('Balance set from %s to %s by admin', _current_balance, _amount))
      );
    ELSIF _delta < 0 THEN
      -- Balance decreased - log as withdrawal
      INSERT INTO withdrawal_requests (
        user_id,
        amount,
        status,
        withdrawal_type,
        processed_by_admin,
        processed_at,
        admin_notes
      ) VALUES (
        _user_id,
        _transaction_amount,
        'approved',
        'admin_adjustment',
        _admin_id,
        now(),
        COALESCE(_reason, format('Balance set from %s to %s by admin', _current_balance, _amount))
      );
    END IF;
    
  ELSIF _operation = 'add' THEN
    -- Add to balance
    UPDATE user_profiles
    SET balance = balance + _amount,
        equity = equity + _amount,
        available_margin = available_margin + _amount,
        updated_at = now()
    WHERE user_id = _user_id;
    
    -- Log as deposit
    INSERT INTO deposit_requests (
      user_id,
      amount,
      status,
      deposit_type,
      processed_by_admin,
      processed_at,
      admin_notes
    ) VALUES (
      _user_id,
      _amount,
      'approved',
      'admin_adjustment',
      _admin_id,
      now(),
      COALESCE(_reason, 'Balance added by admin')
    );
    
  ELSIF _operation = 'deduct' THEN
    -- Deduct from balance
    UPDATE user_profiles
    SET balance = GREATEST(balance - _amount, 0),
        equity = GREATEST(equity - _amount, 0),
        available_margin = GREATEST(available_margin - _amount, 0),
        updated_at = now()
    WHERE user_id = _user_id;
    
    -- Log as withdrawal
    INSERT INTO withdrawal_requests (
      user_id,
      amount,
      status,
      withdrawal_type,
      processed_by_admin,
      processed_at,
      admin_notes
    ) VALUES (
      _user_id,
      _amount,
      'approved',
      'admin_adjustment',
      _admin_id,
      now(),
      COALESCE(_reason, 'Balance deducted by admin')
    );
    
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid operation');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Balance %s successfully', _operation),
    'previous_balance', _current_balance,
    'new_balance', CASE 
      WHEN _operation = 'set' THEN _amount
      WHEN _operation = 'add' THEN _current_balance + _amount
      ELSE GREATEST(_current_balance - _amount, 0)
    END
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;