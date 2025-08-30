-- Critical Security Fix: Add search_path protection to all database functions
-- This prevents search path injection attacks by explicitly setting search_path

-- Update all existing functions to include SET search_path = 'public'

CREATE OR REPLACE FUNCTION public.validate_role_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- For INSERT operations, check if user already has a role
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'User already has a role assigned. Use UPDATE to change roles.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_deposit_request(_admin_id uuid, _request_id uuid, _action text, _admin_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  _request RECORD;
  _user_admin_id UUID;
BEGIN
  -- Get request details
  SELECT * INTO _request FROM deposit_requests WHERE id = _request_id;
  
  IF _request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;
  
  -- Check if admin has access to this user
  SELECT admin_id INTO _user_admin_id FROM user_profiles WHERE user_id = _request.user_id;
  
  IF NOT (has_role(_admin_id, 'super_admin'::app_role) OR _user_admin_id = _admin_id) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Update request status
  UPDATE deposit_requests 
  SET 
    status = _action,
    admin_notes = _admin_notes,
    processed_at = now(),
    processed_by_admin = _admin_id
  WHERE id = _request_id;
  
  -- If approved, update user balance
  IF _action = 'approved' THEN
    UPDATE user_profiles 
    SET 
      balance = balance + _request.amount,
      equity = equity + _request.amount,
      available_margin = available_margin + _request.amount
    WHERE user_id = _request.user_id;
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Request processed successfully');
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_withdrawal_request(_admin_id uuid, _request_id uuid, _action text, _admin_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  _request RECORD;
  _user_admin_id UUID;
  _user_balance NUMERIC;
BEGIN
  -- Get request details
  SELECT * INTO _request FROM withdrawal_requests WHERE id = _request_id;
  
  IF _request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;
  
  -- Check if admin has access to this user
  SELECT admin_id, balance INTO _user_admin_id, _user_balance FROM user_profiles WHERE user_id = _request.user_id;
  
  IF NOT (has_role(_admin_id, 'super_admin'::app_role) OR _user_admin_id = _admin_id) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Check if user has sufficient balance (only for approval)
  IF _action = 'approved' AND _user_balance < _request.amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Update request status
  UPDATE withdrawal_requests 
  SET 
    status = _action,
    admin_notes = _admin_notes,
    processed_at = now(),
    processed_by_admin = _admin_id
  WHERE id = _request_id;
  
  -- If approved, deduct from user balance
  IF _action = 'approved' THEN
    UPDATE user_profiles 
    SET 
      balance = balance - _request.amount,
      equity = equity - _request.amount,
      available_margin = GREATEST(available_margin - _request.amount, 0)
    WHERE user_id = _request.user_id;
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Request processed successfully');
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_admin_user_relationships()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Update user_profiles.admin_id based on admin_user_relationships
  UPDATE user_profiles 
  SET admin_id = aur.admin_id
  FROM admin_user_relationships aur
  WHERE user_profiles.user_id = aur.user_id
  AND user_profiles.admin_id IS DISTINCT FROM aur.admin_id;
  
  -- Insert missing relationships based on user_profiles.admin_id
  INSERT INTO admin_user_relationships (admin_id, user_id)
  SELECT up.admin_id, up.user_id
  FROM user_profiles up
  WHERE up.admin_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM admin_user_relationships aur
    WHERE aur.admin_id = up.admin_id AND aur.user_id = up.user_id
  );
  
  -- Remove orphaned relationships where user_profiles.admin_id is null
  DELETE FROM admin_user_relationships aur
  WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.user_id = aur.user_id AND up.admin_id = aur.admin_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_user_to_admin(_user_id uuid, _new_admin_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Validate admin exists and has admin role
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = _new_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Invalid admin ID or user is not an admin';
  END IF;
  
  -- Update user profile
  UPDATE user_profiles
  SET 
    admin_id = _new_admin_id,
    assignment_method = 'manual',
    assigned_at = now()
  WHERE user_id = _user_id;
  
  -- Upsert admin-user relationship
  INSERT INTO admin_user_relationships (admin_id, user_id)
  VALUES (_new_admin_id, _user_id)
  ON CONFLICT (user_id) 
  DO UPDATE SET admin_id = _new_admin_id;
  
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_promo_code_stats()
 RETURNS TABLE(id uuid, code text, admin_id uuid, admin_email text, is_active boolean, max_uses integer, current_uses integer, expires_at timestamp with time zone, created_at timestamp with time zone, assigned_users_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT 
    pc.id,
    pc.code,
    pc.admin_id,
    up.email as admin_email,
    pc.is_active,
    pc.max_uses,
    pc.current_uses,
    pc.expires_at,
    pc.created_at,
    COUNT(up_users.user_id) as assigned_users_count
  FROM promo_codes pc
  LEFT JOIN user_profiles up ON up.user_id = pc.admin_id
  LEFT JOIN user_profiles up_users ON up_users.promo_code_used = pc.code
  GROUP BY pc.id, pc.code, pc.admin_id, up.email, pc.is_active, pc.max_uses, pc.current_uses, pc.expires_at, pc.created_at
  ORDER BY pc.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_user_financial_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RAISE NOTICE 'Trigger called for user_id: %, OLD admin_id: %, NEW admin_id: %', 
    NEW.user_id, COALESCE(OLD.admin_id::text, 'NULL'), COALESCE(NEW.admin_id::text, 'NULL');

  -- Allow admin assignment (when admin_id changes from NULL to a value)
  IF TG_OP = 'UPDATE' AND OLD.admin_id IS NULL AND NEW.admin_id IS NOT NULL THEN
    RAISE NOTICE 'Allowing admin assignment for user: %', NEW.user_id;
    RETURN NEW;
  END IF;

  -- If the update is being done by the user themselves (not admin/super_admin)
  IF auth.uid() = NEW.user_id AND NOT (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE NOTICE 'Preventing financial field updates by regular user: %', NEW.user_id;
    -- Preserve financial fields from being modified by regular users
    NEW.balance = OLD.balance;
    NEW.equity = OLD.equity;
    NEW.used_margin = OLD.used_margin;
    NEW.available_margin = OLD.available_margin;
    NEW.admin_id = OLD.admin_id;
    NEW.promo_code_used = OLD.promo_code_used;
    NEW.assignment_method = OLD.assignment_method;
    NEW.assigned_at = OLD.assigned_at;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_user_to_admin_via_promo(_user_id uuid, _promo_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  _admin_id UUID;
  _code_data RECORD;
  _user_exists BOOLEAN;
  _update_count INTEGER;
  _current_admin_id UUID;
BEGIN
  RAISE NOTICE 'Starting promo assignment for user % with code %', _user_id, _promo_code;
  
  -- Check if promo code exists and get details
  SELECT admin_id, is_active, expires_at, max_uses, current_uses
  INTO _code_data
  FROM promo_codes
  WHERE code = _promo_code;
  
  -- Validate promo code exists
  IF _code_data IS NULL THEN
    RAISE NOTICE 'Invalid promo code: %', _promo_code;
    RETURN json_build_object('success', false, 'error', 'Invalid promo code');
  END IF;
  
  RAISE NOTICE 'Found promo code with admin_id: %', _code_data.admin_id;
  
  -- Validate promo code is active
  IF NOT _code_data.is_active THEN
    RETURN json_build_object('success', false, 'error', 'Promo code is inactive');
  END IF;
  
  -- Validate not expired
  IF _code_data.expires_at IS NOT NULL AND _code_data.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Promo code has expired');
  END IF;
  
  -- Validate usage limit
  IF _code_data.max_uses IS NOT NULL AND _code_data.current_uses >= _code_data.max_uses THEN
    RETURN json_build_object('success', false, 'error', 'Promo code usage limit reached');
  END IF;
  
  -- Validate admin still exists and has admin role
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = _code_data.admin_id AND role = 'admin'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Associated admin no longer exists');
  END IF;
  
  -- Check if user profile exists and get current admin_id
  SELECT admin_id INTO _current_admin_id
  FROM user_profiles 
  WHERE user_id = _user_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'User profile not found for user: %', _user_id;
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  RAISE NOTICE 'User profile exists. Current admin_id: %', _current_admin_id;
  
  -- Check if user is already assigned to an admin
  IF _current_admin_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'User is already assigned to an admin');
  END IF;
  
  -- Start transaction - all operations must succeed together
  BEGIN
    RAISE NOTICE 'Attempting to update user_profiles for user: % with admin_id: %', _user_id, _code_data.admin_id;
    
    -- Update user profile with admin_id and promo code (bypass trigger using a direct approach)
    UPDATE user_profiles
    SET 
      admin_id = _code_data.admin_id, 
      promo_code_used = _promo_code,
      assignment_method = 'promo_code',
      assigned_at = now(),
      updated_at = now()
    WHERE user_id = _user_id
      AND admin_id IS NULL; -- Double check to prevent overwriting existing assignment
    
    GET DIAGNOSTICS _update_count = ROW_COUNT;
    RAISE NOTICE 'User profile update affected % rows', _update_count;
    
    -- Verify the update worked
    IF _update_count = 0 THEN
      RAISE EXCEPTION 'Failed to update user profile - no rows affected or user already assigned';
    END IF;
    
    -- Verify the update actually took place
    SELECT admin_id INTO _current_admin_id
    FROM user_profiles 
    WHERE user_id = _user_id;
    
    IF _current_admin_id != _code_data.admin_id THEN
      RAISE EXCEPTION 'Update verification failed - admin_id not set correctly. Expected: %, Got: %', _code_data.admin_id, _current_admin_id;
    END IF;
    
    RAISE NOTICE 'Admin assignment verified successfully: %', _current_admin_id;
    
    -- Create admin-user relationship
    RAISE NOTICE 'Creating admin-user relationship';
    INSERT INTO admin_user_relationships (admin_id, user_id)
    VALUES (_code_data.admin_id, _user_id)
    ON CONFLICT (user_id) DO UPDATE SET admin_id = _code_data.admin_id;
    
    -- Only increment usage after successful assignment
    RAISE NOTICE 'Incrementing promo code usage';
    UPDATE promo_codes
    SET current_uses = current_uses + 1,
        updated_at = now()
    WHERE code = _promo_code;
    
    -- Verify the promo code update worked
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Failed to update promo code usage';
    END IF;
    
    RAISE NOTICE 'Promo assignment completed successfully';
    
    RETURN json_build_object(
      'success', true, 
      'admin_id', _code_data.admin_id,
      'message', 'User successfully assigned to admin via promo code'
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Promo assignment failed with error: %', SQLERRM;
      
      -- Transaction will automatically rollback
      RETURN json_build_object(
        'success', false, 
        'error', 'Assignment failed: ' || SQLERRM
      );
  END;
END;
$function$;