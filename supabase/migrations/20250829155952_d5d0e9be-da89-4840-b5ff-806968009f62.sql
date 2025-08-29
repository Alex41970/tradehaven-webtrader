-- Create deposit_requests table
CREATE TABLE public.deposit_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  deposit_type TEXT NOT NULL CHECK (deposit_type IN ('crypto', 'wire')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  crypto_wallet_address TEXT,
  bank_details JSONB,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by_admin UUID
);

-- Create withdrawal_requests table
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  withdrawal_type TEXT NOT NULL CHECK (withdrawal_type IN ('crypto', 'wire')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  crypto_wallet_address TEXT,
  bank_details JSONB,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by_admin UUID
);

-- Create admin_payment_settings table
CREATE TABLE public.admin_payment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  crypto_wallets JSONB DEFAULT '{}',
  bank_wire_details JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_payment_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deposit_requests
CREATE POLICY "Users can view their own deposit requests" 
ON public.deposit_requests 
FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role) OR 
       EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = auth.uid() AND user_id = deposit_requests.user_id));

CREATE POLICY "Users can create their own deposit requests" 
ON public.deposit_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update deposit requests for their users" 
ON public.deposit_requests 
FOR UPDATE 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR 
       EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = auth.uid() AND user_id = deposit_requests.user_id));

-- RLS Policies for withdrawal_requests
CREATE POLICY "Users can view their own withdrawal requests" 
ON public.withdrawal_requests 
FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role) OR 
       EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = auth.uid() AND user_id = withdrawal_requests.user_id));

CREATE POLICY "Users can create their own withdrawal requests" 
ON public.withdrawal_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update withdrawal requests for their users" 
ON public.withdrawal_requests 
FOR UPDATE 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR 
       EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = auth.uid() AND user_id = withdrawal_requests.user_id));

-- RLS Policies for admin_payment_settings
CREATE POLICY "Admins can manage their own payment settings" 
ON public.admin_payment_settings 
FOR ALL 
USING (auth.uid() = admin_id OR has_role(auth.uid(), 'super_admin'::app_role));

-- Create updated_at trigger for admin_payment_settings
CREATE TRIGGER update_admin_payment_settings_updated_at
BEFORE UPDATE ON public.admin_payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create functions to process deposits and withdrawals
CREATE OR REPLACE FUNCTION public.process_deposit_request(_admin_id UUID, _request_id UUID, _action TEXT, _admin_notes TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _request RECORD;
  _user_admin_id UUID;
BEGIN
  -- Get request details
  SELECT * INTO _request FROM deposit_requests WHERE id = _request_id;
  
  IF _request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;
  
  -- Check if admin has access to this user
  SELECT admin_id INTO _user_admin_id FROM user_profiles WHERE user_id = _request.user_id;
  
  IF NOT (has_role(_admin_id, 'super_admin'::app_role) OR _user_admin_id = _admin_id) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Update request status
  UPDATE deposit_requests 
  SET 
    status = _action,
    admin_notes = _admin_notes,
    processed_at = now(),
    processed_by_admin = _admin_id
  WHERE id = _request_id;
  
  -- If approved, update user balance
  IF _action = 'approved' THEN
    UPDATE user_profiles 
    SET 
      balance = balance + _request.amount,
      equity = equity + _request.amount,
      available_margin = available_margin + _request.amount
    WHERE user_id = _request.user_id;
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Request processed successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.process_withdrawal_request(_admin_id UUID, _request_id UUID, _action TEXT, _admin_notes TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _request RECORD;
  _user_admin_id UUID;
  _user_balance NUMERIC;
BEGIN
  -- Get request details
  SELECT * INTO _request FROM withdrawal_requests WHERE id = _request_id;
  
  IF _request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;
  
  -- Check if admin has access to this user
  SELECT admin_id, balance INTO _user_admin_id, _user_balance FROM user_profiles WHERE user_id = _request.user_id;
  
  IF NOT (has_role(_admin_id, 'super_admin'::app_role) OR _user_admin_id = _admin_id) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Check if user has sufficient balance (only for approval)
  IF _action = 'approved' AND _user_balance < _request.amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Update request status
  UPDATE withdrawal_requests 
  SET 
    status = _action,
    admin_notes = _admin_notes,
    processed_at = now(),
    processed_by_admin = _admin_id
  WHERE id = _request_id;
  
  -- If approved, deduct from user balance
  IF _action = 'approved' THEN
    UPDATE user_profiles 
    SET 
      balance = balance - _request.amount,
      equity = equity - _request.amount,
      available_margin = GREATEST(available_margin - _request.amount, 0)
    WHERE user_id = _request.user_id;
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Request processed successfully');
END;
$$;