-- Update existing handle_new_user function to include promo code assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        
        -- Increment promo code usage
        UPDATE promo_codes
        SET current_uses = current_uses + 1,
            updated_at = now()
        WHERE code = trim(v_promo_code);
        
        -- Update validation attempt with user_id (using subquery for ORDER BY)
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
$$;