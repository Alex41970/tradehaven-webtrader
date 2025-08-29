-- Fix security issue with user_profiles table RLS policies
-- Current policy has potential security risks with complex OR conditions

-- Drop existing policies first
DROP POLICY IF EXISTS "Users and their admins can view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

-- Create more secure, explicit policies

-- 1. Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2. Admins can view profiles of users assigned to them
CREATE POLICY "Admins can view assigned user profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.admin_user_relationships 
    WHERE admin_id = auth.uid() AND user_id = user_profiles.user_id
  )
);

-- 3. Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 4. Users can insert their own profile only
CREATE POLICY "Users can insert own profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 5. Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile basic info"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  -- Prevent users from modifying financial data directly
  OLD.balance = NEW.balance AND
  OLD.equity = NEW.equity AND
  OLD.used_margin = NEW.used_margin AND
  OLD.available_margin = NEW.available_margin AND
  OLD.admin_id = NEW.admin_id
);

-- 6. Admins can update financial data for their assigned users
CREATE POLICY "Admins can update assigned user finances"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) AND
  EXISTS (
    SELECT 1 FROM public.admin_user_relationships 
    WHERE admin_id = auth.uid() AND user_id = user_profiles.user_id
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) AND
  EXISTS (
    SELECT 1 FROM public.admin_user_relationships 
    WHERE admin_id = auth.uid() AND user_id = user_profiles.user_id
  )
);

-- 7. Super admins can update any profile
CREATE POLICY "Super admins can update any profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));