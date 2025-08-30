-- Create trade_orders table for pending orders
CREATE TABLE public.trade_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  order_type TEXT NOT NULL DEFAULT 'market', -- market, limit, stop
  trade_type TEXT NOT NULL, -- BUY, SELL
  amount NUMERIC NOT NULL,
  leverage INTEGER NOT NULL DEFAULT 1,
  trigger_price NUMERIC, -- For limit/stop orders
  stop_loss_price NUMERIC, 
  take_profit_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, filled, cancelled, expired
  expires_at TIMESTAMP WITH TIME ZONE,
  filled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add stop loss and take profit to existing trades table
ALTER TABLE public.trades 
ADD COLUMN stop_loss_price NUMERIC,
ADD COLUMN take_profit_price NUMERIC,
ADD COLUMN parent_order_id UUID;

-- Enable RLS on trade_orders
ALTER TABLE public.trade_orders ENABLE ROW LEVEL SECURITY;

-- Create policies for trade_orders
CREATE POLICY "Users can view their own trade orders"
ON public.trade_orders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trade orders"
ON public.trade_orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trade orders"
ON public.trade_orders FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view trade orders for their assigned users
CREATE POLICY "Admins can view assigned users trade orders"
ON public.trade_orders FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  EXISTS (
    SELECT 1 FROM admin_user_relationships 
    WHERE admin_id = auth.uid() AND user_id = trade_orders.user_id
  )
);

-- Create foreign key constraints
ALTER TABLE public.trade_orders
ADD CONSTRAINT fk_trade_orders_user_profiles
FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
ON DELETE CASCADE;

ALTER TABLE public.trade_orders
ADD CONSTRAINT fk_trade_orders_assets
FOREIGN KEY (asset_id) REFERENCES public.assets(id)
ON DELETE CASCADE;

-- Add foreign key for parent_order_id in trades
ALTER TABLE public.trades
ADD CONSTRAINT fk_trades_parent_order
FOREIGN KEY (parent_order_id) REFERENCES public.trade_orders(id)
ON DELETE SET NULL;

-- Create updated_at trigger for trade_orders
CREATE TRIGGER update_trade_orders_updated_at
BEFORE UPDATE ON public.trade_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_trade_orders_user_status ON public.trade_orders(user_id, status);
CREATE INDEX idx_trade_orders_trigger_price ON public.trade_orders(trigger_price) WHERE status = 'pending';
CREATE INDEX idx_trades_stop_take_profit ON public.trades(user_id, status) WHERE stop_loss_price IS NOT NULL OR take_profit_price IS NOT NULL;