-- Security fix: Strengthen RLS policies for user_profiles table to prevent unauthorized access to personal data

-- First, let's check if RLS is enabled (should already be, but ensuring it)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to rebuild them with stronger security
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own basic info" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view assigned user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update assigned users" ON public.user_profiles;

-- Create comprehensive RLS policies with explicit authentication requirements

-- Policy 1: Users can only view their own profile (authenticated users only)
CREATE POLICY "Users can view own profile only" 
ON public.user_profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Users can only insert their own profile (authenticated users only)
CREATE POLICY "Users can insert own profile only" 
ON public.user_profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can only update their own basic profile info (prevent financial field tampering)
CREATE POLICY "Users can update own basic info only" 
ON public.user_profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Admins can view profiles of their assigned users only
CREATE POLICY "Admins can view assigned user profiles only" 
ON public.user_profiles 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND EXISTS (
    SELECT 1 
    FROM admin_user_relationships 
    WHERE admin_id = auth.uid() 
    AND user_id = user_profiles.user_id
  )
);

-- Policy 5: Super admins can view all profiles (authenticated super admins only)
CREATE POLICY "Super admins can view all profiles" 
ON public.user_profiles 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Policy 6: Admins can update their assigned users (with proper checks)
CREATE POLICY "Admins can update assigned users only" 
ON public.user_profiles 
FOR UPDATE 
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (
    EXISTS (
      SELECT 1 
      FROM admin_user_relationships 
      WHERE admin_id = auth.uid() 
      AND user_id = user_profiles.user_id
    ) 
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (
    EXISTS (
      SELECT 1 
      FROM admin_user_relationships 
      WHERE admin_id = auth.uid() 
      AND user_id = user_profiles.user_id
    ) 
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- Policy 7: Explicitly deny all access to anonymous/unauthenticated users
CREATE POLICY "Deny all access to anonymous users" 
ON public.user_profiles 
FOR ALL 
TO anon
USING (false);

-- Also strengthen deposit_requests table security
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

-- Drop and recreate deposit_requests policies with explicit authentication
DROP POLICY IF EXISTS "Users can view their own deposit requests" ON public.deposit_requests;
DROP POLICY IF EXISTS "Users can create their own deposit requests" ON public.deposit_requests;
DROP POLICY IF EXISTS "Admins can update deposit requests for their users" ON public.deposit_requests;

-- Recreate with stronger security
CREATE POLICY "Users can view own deposit requests only" 
ON public.deposit_requests 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'super_admin'::app_role) 
  OR EXISTS (
    SELECT 1 
    FROM admin_user_relationships 
    WHERE admin_id = auth.uid() 
    AND user_id = deposit_requests.user_id
  )
);

CREATE POLICY "Users can create own deposit requests only" 
ON public.deposit_requests 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update assigned user deposit requests only" 
ON public.deposit_requests 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR EXISTS (
    SELECT 1 
    FROM admin_user_relationships 
    WHERE admin_id = auth.uid() 
    AND user_id = deposit_requests.user_id
  )
);

CREATE POLICY "Deny deposit access to anonymous users" 
ON public.deposit_requests 
FOR ALL 
TO anon
USING (false);