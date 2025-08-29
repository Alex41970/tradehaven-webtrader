-- Fix security issue with user_profiles table RLS policies (corrected version)
-- Replace complex OR conditions with explicit, secure policies

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

-- 5. Users can update their basic info only (not financial data)
CREATE POLICY "Users can update own basic info"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Admins can update their assigned users' data
CREATE POLICY "Admins can update assigned users"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) AND
  (EXISTS (
    SELECT 1 FROM public.admin_user_relationships 
    WHERE admin_id = auth.uid() AND user_id = user_profiles.user_id
  ) OR has_role(auth.uid(), 'super_admin'::app_role))
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) AND
  (EXISTS (
    SELECT 1 FROM public.admin_user_relationships 
    WHERE admin_id = auth.uid() AND user_id = user_profiles.user_id
  ) OR has_role(auth.uid(), 'super_admin'::app_role))
);

-- Create a function to prevent users from updating financial fields directly
CREATE OR REPLACE FUNCTION public.prevent_user_financial_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

-- Create trigger to enforce financial field restrictions
DROP TRIGGER IF EXISTS prevent_user_financial_updates_trigger ON public.user_profiles;
CREATE TRIGGER prevent_user_financial_updates_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_financial_updates();