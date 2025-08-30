-- Fix the prevent_user_financial_updates trigger to allow admin assignments
CREATE OR REPLACE FUNCTION public.prevent_user_financial_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow updates from the promo assignment function
  -- Check if this is being called from our assignment function
  IF TG_OP = 'UPDATE' AND current_setting('app.assignment_context', true) = 'promo_assignment' THEN
    RETURN NEW;
  END IF;

  -- If the update is being done by the user themselves (not admin/super_admin)
  IF auth.uid() = NEW.user_id AND NOT (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
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

-- Update the assign_user_to_admin_via_promo function with better logging and context setting
CREATE OR REPLACE FUNCTION public.assign_user_to_admin_via_promo(_user_id uuid, _promo_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _admin_id UUID;
  _code_data RECORD;
  _user_exists BOOLEAN;
  _update_count INTEGER;
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
  
  -- Check if user profile exists
  SELECT EXISTS(SELECT 1 FROM user_profiles WHERE user_id = _user_id) INTO _user_exists;
  
  IF NOT _user_exists THEN
    RAISE NOTICE 'User profile not found for user: %', _user_id;
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  RAISE NOTICE 'User profile exists for user: %', _user_id;
  
  -- Check if user is already assigned to an admin
  IF EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = _user_id AND admin_id IS NOT NULL
  ) THEN
    RETURN json_build_object('success', false, 'error', 'User is already assigned to an admin');
  END IF;
  
  -- Start transaction - all operations must succeed together
  BEGIN
    -- Set context for the trigger to allow this update
    PERFORM set_config('app.assignment_context', 'promo_assignment', true);
    
    RAISE NOTICE 'Attempting to update user_profiles for user: % with admin_id: %', _user_id, _code_data.admin_id;
    
    -- Update user profile with admin_id and promo code
    UPDATE user_profiles
    SET 
      admin_id = _code_data.admin_id, 
      promo_code_used = _promo_code,
      assignment_method = 'promo_code',
      assigned_at = now()
    WHERE user_id = _user_id;
    
    GET DIAGNOSTICS _update_count = ROW_COUNT;
    RAISE NOTICE 'User profile update affected % rows', _update_count;
    
    -- Verify the update worked
    IF _update_count = 0 THEN
      RAISE EXCEPTION 'Failed to update user profile - no rows affected';
    END IF;
    
    -- Create admin-user relationship
    RAISE NOTICE 'Creating admin-user relationship';
    INSERT INTO admin_user_relationships (admin_id, user_id)
    VALUES (_code_data.admin_id, _user_id)
    ON CONFLICT (user_id) DO UPDATE SET admin_id = _code_data.admin_id;
    
    -- Only increment usage after successful assignment
    RAISE NOTICE 'Incrementing promo code usage';
    UPDATE promo_codes
    SET current_uses = current_uses + 1
    WHERE code = _promo_code;
    
    -- Verify the promo code update worked
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Failed to update promo code usage';
    END IF;
    
    -- Reset the context
    PERFORM set_config('app.assignment_context', '', true);
    
    RAISE NOTICE 'Promo assignment completed successfully';
    
    RETURN json_build_object(
      'success', true, 
      'admin_id', _code_data.admin_id,
      'message', 'User successfully assigned to admin via promo code'
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Reset the context on error
      PERFORM set_config('app.assignment_context', '', true);
      
      RAISE NOTICE 'Promo assignment failed with error: %', SQLERRM;
      
      -- Transaction will automatically rollback
      RETURN json_build_object(
        'success', false, 
        'error', 'Assignment failed: ' || SQLERRM
      );
  END;
END;
$function$;