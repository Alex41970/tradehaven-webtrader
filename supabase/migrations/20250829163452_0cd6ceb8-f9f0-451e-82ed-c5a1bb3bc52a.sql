-- Create user_payment_settings table for per-user payment configurations
CREATE TABLE public.user_payment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  crypto_wallets JSONB DEFAULT '{}'::jsonb,
  bank_wire_details JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_payment_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user_payment_settings
CREATE POLICY "Admins can manage their users' payment settings" 
ON public.user_payment_settings 
FOR ALL 
USING (
  (auth.uid() = admin_id) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (EXISTS (
    SELECT 1 FROM admin_user_relationships 
    WHERE admin_id = auth.uid() AND user_id = user_payment_settings.user_id
  ))
);

CREATE POLICY "Users can view their own payment settings" 
ON public.user_payment_settings 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_payment_settings_updated_at
BEFORE UPDATE ON public.user_payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();