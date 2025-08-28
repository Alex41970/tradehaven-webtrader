-- Fix data consistency and add enhanced promo code functionality
-- Drop existing function first to change return type

DROP FUNCTION IF EXISTS assign_user_to_admin_via_promo(uuid, text);

-- Create function to sync admin user relationships with user profiles
CREATE OR REPLACE FUNCTION sync_admin_user_relationships()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Execute the sync function to fix existing data
SELECT sync_admin_user_relationships();

-- Add assignment tracking to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS assignment_method TEXT DEFAULT 'manual';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing records to have proper assignment method
UPDATE user_profiles 
SET assignment_method = CASE 
  WHEN promo_code_used IS NOT NULL THEN 'promo_code'
  ELSE 'manual'
END
WHERE assignment_method = 'manual';

-- Add function to handle atomic user transfer
CREATE OR REPLACE FUNCTION transfer_user_to_admin(_user_id uuid, _new_admin_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Add function to get comprehensive promo code statistics
CREATE OR REPLACE FUNCTION get_promo_code_stats()
RETURNS TABLE (
  id uuid,
  code text,
  admin_id uuid,
  admin_email text,
  is_active boolean,
  max_uses integer,
  current_uses integer,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  assigned_users_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
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
$$;

-- Enhanced promo code assignment function with better validation
CREATE OR REPLACE FUNCTION assign_user_to_admin_via_promo(_user_id uuid, _promo_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _admin_id UUID;
  _code_data RECORD;
  result json;
BEGIN
  -- Check if promo code exists and get details
  SELECT admin_id, is_active, expires_at, max_uses, current_uses
  INTO _code_data
  FROM public.promo_codes
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
  
  -- Update user profile with admin_id and promo code
  UPDATE public.user_profiles
  SET 
    admin_id = _code_data.admin_id, 
    promo_code_used = _promo_code,
    assignment_method = 'promo_code',
    assigned_at = now()
  WHERE user_id = _user_id;
  
  -- Create admin-user relationship
  INSERT INTO public.admin_user_relationships (admin_id, user_id)
  VALUES (_code_data.admin_id, _user_id)
  ON CONFLICT (user_id) DO UPDATE SET admin_id = _code_data.admin_id;
  
  -- Increment promo code usage
  UPDATE public.promo_codes
  SET current_uses = current_uses + 1
  WHERE code = _promo_code;
  
  RETURN json_build_object('success', true, 'admin_id', _code_data.admin_id);
END;
$$;