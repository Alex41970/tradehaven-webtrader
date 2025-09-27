-- =========================================
-- SECURITY FIX: Improve RLS policies for user_profiles and deposit_requests
-- =========================================

-- First, let's drop the problematic "false" policies and replace them with explicit ones

-- Fix user_profiles table policies
DROP POLICY IF EXISTS "Deny all access to anonymous users" ON public.user_profiles;

-- Create explicit policy to deny access to unauthenticated users
CREATE POLICY "Authenticated users only"
ON public.user_profiles
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- Strengthen the user profile access policy to be more explicit
DROP POLICY IF EXISTS "Users can view own profile only" ON public.user_profiles;
CREATE POLICY "Users can view own profile only"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Strengthen the user update policy
DROP POLICY IF EXISTS "Users can update own basic info only" ON public.user_profiles;
CREATE POLICY "Users can update own basic info only"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix deposit_requests table policies
DROP POLICY IF EXISTS "Deny deposit access to anonymous users" ON public.deposit_requests;

-- Create explicit policy to deny access to unauthenticated users
CREATE POLICY "Authenticated users only"
ON public.deposit_requests
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- Strengthen deposit request access policies
DROP POLICY IF EXISTS "Users can view own deposit requests only" ON public.deposit_requests;
CREATE POLICY "Users can view own deposit requests only"
ON public.deposit_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'super_admin'::app_role) 
  OR EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = auth.uid() AND user_id = deposit_requests.user_id
  )
);

-- Strengthen deposit request creation policy
DROP POLICY IF EXISTS "Users can create own deposit requests only" ON public.deposit_requests;
CREATE POLICY "Users can create own deposit requests only"
ON public.deposit_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Strengthen deposit request update policy (admin only)
DROP POLICY IF EXISTS "Admins can update assigned user deposit requests only" ON public.deposit_requests;
CREATE POLICY "Admins can update assigned user deposit requests only"
ON public.deposit_requests
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = auth.uid() AND user_id = deposit_requests.user_id
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = auth.uid() AND user_id = deposit_requests.user_id
  )
);

-- Add additional security policies for withdrawal_requests table
DROP POLICY IF EXISTS "Users can view their own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can view their own withdrawal requests"
ON public.withdrawal_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'super_admin'::app_role) 
  OR EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = auth.uid() AND user_id = withdrawal_requests.user_id
  )
);

-- Add explicit authentication requirement for withdrawal requests
CREATE POLICY "Authenticated users only"
ON public.withdrawal_requests
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- Strengthen user_payment_settings security
CREATE POLICY "Authenticated users only"
ON public.user_payment_settings
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- Add explicit authentication requirement for admin_payment_settings
CREATE POLICY "Authenticated users only"
ON public.admin_payment_settings
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- Add comment for documentation
COMMENT ON TABLE public.user_profiles IS 'Contains sensitive PII and financial data. Access restricted to authenticated users only with user-specific or admin-level permissions.';
COMMENT ON TABLE public.deposit_requests IS 'Contains sensitive financial transaction data. Access restricted to authenticated users with proper authorization levels.';
COMMENT ON TABLE public.withdrawal_requests IS 'Contains sensitive financial transaction data. Access restricted to authenticated users with proper authorization levels.';