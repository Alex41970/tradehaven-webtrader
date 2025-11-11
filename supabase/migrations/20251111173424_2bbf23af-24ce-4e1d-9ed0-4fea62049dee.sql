-- Fix handle_new_user trigger to remove non-existent updated_at column
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_promo_code TEXT;
  v_code_data RECORD;
BEGIN
  -- Insert user profile with $0 starting balance
  INSERT INTO user_profiles (
    user_id, 
    email, 
    first_name,
    surname,
    phone_number,
    balance, 
    equity, 
    available_margin
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'surname',
    NEW.raw_user_meta_data ->> 'phone_number',
    0.00,
    0.00,
    0.00
  );
  
  -- Insert default user role
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  -- Handle promo code assignment if provided
  v_promo_code := NEW.raw_user_meta_data->>'promo_code';
  
  IF v_promo_code IS NOT NULL AND trim(v_promo_code) != '' THEN
    BEGIN
      -- Get promo code details
      SELECT * INTO v_code_data
      FROM promo_codes
      WHERE code = trim(v_promo_code);
      
      -- Only proceed if promo code is valid
      IF v_code_data IS NOT NULL 
         AND v_code_data.is_active 
         AND (v_code_data.expires_at IS NULL OR v_code_data.expires_at > now())
         AND (v_code_data.max_uses IS NULL OR v_code_data.current_uses < v_code_data.max_uses)
         AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_code_data.admin_id AND role = 'admin')
      THEN
        -- Update user profile with admin assignment
        UPDATE user_profiles
        SET 
          admin_id = v_code_data.admin_id,
          promo_code_used = trim(v_promo_code),
          assignment_method = 'promo_code',
          assigned_at = now()
        WHERE user_id = NEW.id;
        
        -- Create admin-user relationship
        INSERT INTO admin_user_relationships (admin_id, user_id)
        VALUES (v_code_data.admin_id, NEW.id);
        
        -- Increment promo code usage (non-critical, isolated in exception block)
        BEGIN
          UPDATE promo_codes
          SET current_uses = current_uses + 1
          WHERE code = trim(v_promo_code);
          
          -- Update validation attempt with user_id
          UPDATE promo_validation_attempts
          SET resulted_in_signup = true,
              created_user_id = NEW.id
          WHERE id = (
            SELECT id FROM promo_validation_attempts
            WHERE promo_code = trim(v_promo_code)
              AND created_user_id IS NULL
            ORDER BY attempted_at DESC
            LIMIT 1
          );
        EXCEPTION
          WHEN OTHERS THEN
            -- Log but don't block the assignment
            RAISE WARNING 'Failed to update promo usage/validation: %', SQLERRM;
        END;
        
        RAISE NOTICE 'User % assigned to admin % via promo code %', NEW.id, v_code_data.admin_id, v_promo_code;
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Log but don't block signup
        RAISE WARNING 'Promo code assignment failed: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix assign_user_to_admin_via_promo RPC to remove non-existent updated_at column
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
    
    -- Update user profile with admin_id and promo code
    UPDATE user_profiles
    SET 
      admin_id = _code_data.admin_id, 
      promo_code_used = _promo_code,
      assignment_method = 'promo_code',
      assigned_at = now()
    WHERE user_id = _user_id
      AND admin_id IS NULL;
    
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
    
    -- Increment promo code usage (non-critical, isolated)
    BEGIN
      RAISE NOTICE 'Incrementing promo code usage';
      UPDATE promo_codes
      SET current_uses = current_uses + 1
      WHERE code = _promo_code;
      
      IF NOT FOUND THEN
        RAISE WARNING 'Failed to update promo code usage';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to increment promo usage: %', SQLERRM;
    END;
    
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