-- Create multi-tier admin system with roles, relationships, and promo codes

-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');

-- Create user roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create promo codes table
CREATE TABLE public.promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_uses INTEGER DEFAULT NULL,
  current_uses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Create admin user relationships table
CREATE TABLE public.admin_user_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id) -- Each user can only have one admin
);

-- Add admin_id and promo_code_used to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN admin_id UUID REFERENCES auth.users(id),
ADD COLUMN promo_code_used TEXT;

-- Enable RLS on new tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_relationships ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'user' THEN 3
    END
  LIMIT 1
$$;

-- Create function to assign user to admin via promo code
CREATE OR REPLACE FUNCTION public.assign_user_to_admin_via_promo(_user_id UUID, _promo_code TEXT)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  _admin_id UUID;
  _code_valid BOOLEAN := false;
BEGIN
  -- Check if promo code exists and is valid
  SELECT admin_id INTO _admin_id
  FROM public.promo_codes
  WHERE code = _promo_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR current_uses < max_uses);
  
  IF _admin_id IS NOT NULL THEN
    -- Update user profile with admin_id and promo code
    UPDATE public.user_profiles
    SET admin_id = _admin_id, promo_code_used = _promo_code
    WHERE user_id = _user_id;
    
    -- Create admin-user relationship
    INSERT INTO public.admin_user_relationships (admin_id, user_id)
    VALUES (_admin_id, _user_id)
    ON CONFLICT (user_id) DO UPDATE SET admin_id = _admin_id;
    
    -- Increment promo code usage
    UPDATE public.promo_codes
    SET current_uses = current_uses + 1
    WHERE code = _promo_code;
    
    _code_valid := true;
  END IF;
  
  RETURN _code_valid;
END;
$$;

-- Create function for admins to modify user balance
CREATE OR REPLACE FUNCTION public.admin_modify_user_balance(_admin_id UUID, _user_id UUID, _amount NUMERIC, _operation TEXT)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
  -- Verify admin has access to this user
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _user_id
  ) AND NOT public.has_role(_admin_id, 'super_admin') THEN
    RETURN false;
  END IF;
  
  -- Modify balance
  IF _operation = 'add' THEN
    UPDATE public.user_profiles
    SET balance = balance + _amount,
        equity = equity + _amount,
        available_margin = available_margin + _amount
    WHERE user_id = _user_id;
  ELSIF _operation = 'deduct' THEN
    UPDATE public.user_profiles
    SET balance = GREATEST(balance - _amount, 0),
        equity = GREATEST(equity - _amount, 0),
        available_margin = GREATEST(available_margin - _amount, 0)
    WHERE user_id = _user_id;
  END IF;
  
  RETURN true;
END;
$$;

-- Create function for admins to modify trade open price
CREATE OR REPLACE FUNCTION public.admin_modify_trade_open_price(_admin_id UUID, _trade_id UUID, _new_open_price NUMERIC)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  _trade_user_id UUID;
BEGIN
  -- Get the user_id for this trade
  SELECT user_id INTO _trade_user_id
  FROM public.trades
  WHERE id = _trade_id;
  
  -- Verify admin has access to this user's trades
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _trade_user_id
  ) AND NOT public.has_role(_admin_id, 'super_admin') THEN
    RETURN false;
  END IF;
  
  -- Update trade open price
  UPDATE public.trades
  SET open_price = _new_open_price
  WHERE id = _trade_id;
  
  RETURN true;
END;
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for promo_codes
CREATE POLICY "Admins can view their own promo codes"
ON public.promo_codes
FOR SELECT
USING (auth.uid() = admin_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage their own promo codes"
ON public.promo_codes
FOR ALL
USING (auth.uid() = admin_id OR public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for admin_user_relationships
CREATE POLICY "Admins can view their user relationships"
ON public.admin_user_relationships
FOR SELECT
USING (auth.uid() = admin_id OR auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage all relationships"
ON public.admin_user_relationships
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Update user_profiles policies to include admin access
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users and their admins can view profiles"
ON public.user_profiles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR auth.uid() = admin_id 
  OR public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.admin_user_relationships
    WHERE admin_id = auth.uid() AND user_id = public.user_profiles.user_id
  )
);

-- Update trades policies to include admin access
DROP POLICY IF EXISTS "Users can view their own trades" ON public.trades;
CREATE POLICY "Users and their admins can view trades"
ON public.trades
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.admin_user_relationships
    WHERE admin_id = auth.uid() AND user_id = public.trades.user_id
  )
);

-- Create trigger to assign default user role on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Update the existing trigger to also handle roles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert user profile
  INSERT INTO public.user_profiles (user_id, email, balance, equity, available_margin)
  VALUES (
    NEW.id,
    NEW.email,
    10000.00,
    10000.00,
    10000.00
  );
  
  -- Insert default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();