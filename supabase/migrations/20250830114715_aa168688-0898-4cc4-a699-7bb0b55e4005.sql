-- Fix the assign_user_to_admin_via_promo function to properly assign users
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
BEGIN
  -- Check if promo code exists and get details
  SELECT admin_id, is_active, expires_at, max_uses, current_uses
  INTO _code_data
  FROM promo_codes
  WHERE code = _promo_code;
  
  -- Validate promo code exists
  IF _code_data IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid promo code');
  END IF;
  
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
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  -- Check if user is already assigned to an admin
  IF EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = _user_id AND admin_id IS NOT NULL
  ) THEN
    RETURN json_build_object('success', false, 'error', 'User is already assigned to an admin');
  END IF;
  
  -- Start transaction - all operations must succeed together
  BEGIN
    -- Update user profile with admin_id and promo code
    UPDATE user_profiles
    SET 
      admin_id = _code_data.admin_id, 
      promo_code_used = _promo_code,
      assignment_method = 'promo_code',
      assigned_at = now()
    WHERE user_id = _user_id;
    
    -- Verify the update worked
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Failed to update user profile';
    END IF;
    
    -- Create admin-user relationship
    INSERT INTO admin_user_relationships (admin_id, user_id)
    VALUES (_code_data.admin_id, _user_id)
    ON CONFLICT (user_id) DO UPDATE SET admin_id = _code_data.admin_id;
    
    -- Only increment usage after successful assignment
    UPDATE promo_codes
    SET current_uses = current_uses + 1
    WHERE code = _promo_code;
    
    -- Verify the promo code update worked
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Failed to update promo code usage';
    END IF;
    
    RETURN json_build_object(
      'success', true, 
      'admin_id', _code_data.admin_id,
      'message', 'User successfully assigned to admin via promo code'
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Transaction will automatically rollback
      RETURN json_build_object(
        'success', false, 
        'error', 'Assignment failed: ' || SQLERRM
      );
  END;
END;
$function$