-- Create user profiles table with account balance
CREATE TABLE public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  balance DECIMAL(15,2) NOT NULL DEFAULT 10000.00,
  equity DECIMAL(15,2) NOT NULL DEFAULT 10000.00,
  used_margin DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  available_margin DECIMAL(15,2) NOT NULL DEFAULT 10000.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
CREATE POLICY "Users can view their own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create assets table
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('forex', 'crypto', 'stocks', 'commodities', 'indices')),
  price DECIMAL(15,8) NOT NULL,
  change_24h DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  min_trade_size DECIMAL(10,4) NOT NULL DEFAULT 0.01,
  max_leverage INTEGER NOT NULL DEFAULT 100,
  spread DECIMAL(8,4) NOT NULL DEFAULT 0.0001,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on assets (public read access)
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assets are viewable by everyone"
ON public.assets
FOR SELECT
USING (true);

-- Create trades table
CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  symbol TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('BUY', 'SELL')),
  amount DECIMAL(15,4) NOT NULL,
  leverage INTEGER NOT NULL DEFAULT 1,
  open_price DECIMAL(15,8) NOT NULL,
  close_price DECIMAL(15,8),
  current_price DECIMAL(15,8),
  pnl DECIMAL(15,2) DEFAULT 0.00,
  margin_used DECIMAL(15,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on trades
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for trades
CREATE POLICY "Users can view their own trades"
ON public.trades
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trades"
ON public.trades
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades"
ON public.trades
FOR UPDATE
USING (auth.uid() = user_id);

-- Create user_favorites table
CREATE TABLE public.user_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, asset_id)
);

-- Enable RLS on user_favorites
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_favorites
CREATE POLICY "Users can manage their own favorites"
ON public.user_favorites
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, balance, equity, available_margin)
  VALUES (
    NEW.id,
    NEW.email,
    10000.00,
    10000.00,
    10000.00
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to calculate P&L
CREATE OR REPLACE FUNCTION public.calculate_pnl(
  trade_type TEXT,
  amount DECIMAL,
  open_price DECIMAL,
  current_price DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  IF trade_type = 'BUY' THEN
    RETURN amount * (current_price - open_price);
  ELSE
    RETURN amount * (open_price - current_price);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to update user balance when trade is closed
CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_close()
RETURNS TRIGGER AS $$
DECLARE
  pnl_amount DECIMAL;
BEGIN
  -- Only process when trade status changes to 'closed'
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    pnl_amount = NEW.pnl;
    
    -- Update user balance and available margin
    UPDATE public.user_profiles
    SET 
      balance = balance + pnl_amount + NEW.margin_used,
      used_margin = used_margin - NEW.margin_used,
      available_margin = available_margin + NEW.margin_used + pnl_amount,
      equity = balance + pnl_amount
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for trade closure
CREATE TRIGGER on_trade_closed
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_close();

-- Insert sample assets data
INSERT INTO public.assets (symbol, name, category, price, change_24h, max_leverage, spread) VALUES
-- Forex pairs
('EURUSD', 'Euro / US Dollar', 'forex', 1.08450, 0.0023, 500, 0.00015),
('GBPUSD', 'British Pound / US Dollar', 'forex', 1.26750, -0.0045, 500, 0.00020),
('USDJPY', 'US Dollar / Japanese Yen', 'forex', 149.850, 0.0134, 500, 0.00025),
('USDCHF', 'US Dollar / Swiss Franc', 'forex', 0.87420, 0.0012, 500, 0.00018),
('AUDUSD', 'Australian Dollar / US Dollar', 'forex', 0.65340, -0.0028, 400, 0.00022),
('USDCAD', 'US Dollar / Canadian Dollar', 'forex', 1.37250, 0.0019, 400, 0.00025),
('NZDUSD', 'New Zealand Dollar / US Dollar', 'forex', 0.59120, -0.0033, 400, 0.00030),
('EURGBP', 'Euro / British Pound', 'forex', 0.85680, 0.0015, 300, 0.00020),
('EURJPY', 'Euro / Japanese Yen', 'forex', 162.450, 0.0089, 300, 0.00035),
('GBPJPY', 'British Pound / Japanese Yen', 'forex', 189.750, 0.0156, 300, 0.00040),

-- Cryptocurrencies
('BTCUSD', 'Bitcoin', 'crypto', 42350.50, 2.45, 100, 5.00),
('ETHUSD', 'Ethereum', 'crypto', 2580.75, 1.89, 100, 2.50),
('ADAUSD', 'Cardano', 'crypto', 0.4521, -1.23, 50, 0.0015),
('SOLUSD', 'Solana', 'crypto', 98.45, 3.67, 75, 0.25),
('DOTUSD', 'Polkadot', 'crypto', 7.234, -0.89, 50, 0.015),
('LINKUSD', 'Chainlink', 'crypto', 15.67, 1.45, 50, 0.05),
('LTCUSD', 'Litecoin', 'crypto', 72.45, 0.67, 75, 0.15),
('BNBUSD', 'Binance Coin', 'crypto', 315.80, 2.12, 75, 1.25),
('XRPUSD', 'XRP', 'crypto', 0.6234, -2.34, 50, 0.002),
('MATICUSD', 'Polygon', 'crypto', 0.8456, 1.78, 50, 0.005),

-- US Stocks
('AAPL', 'Apple Inc.', 'stocks', 175.25, 1.25, 20, 0.01),
('MSFT', 'Microsoft Corporation', 'stocks', 378.50, 0.85, 20, 0.02),
('GOOGL', 'Alphabet Inc.', 'stocks', 142.75, -0.65, 20, 0.05),
('AMZN', 'Amazon.com Inc.', 'stocks', 153.80, 2.15, 20, 0.03),
('TSLA', 'Tesla Inc.', 'stocks', 248.50, 3.45, 10, 0.10),
('META', 'Meta Platforms Inc.', 'stocks', 342.75, 1.89, 15, 0.05),
('NFLX', 'Netflix Inc.', 'stocks', 485.60, -1.23, 15, 0.15),
('NVDA', 'NVIDIA Corporation', 'stocks', 875.30, 4.67, 10, 0.25),
('AMD', 'Advanced Micro Devices', 'stocks', 142.80, 2.34, 15, 0.08),
('INTC', 'Intel Corporation', 'stocks', 43.25, -0.45, 20, 0.02),

-- Commodities
('XAUUSD', 'Gold', 'commodities', 2045.75, 0.34, 100, 0.50),
('XAGUSD', 'Silver', 'commodities', 23.45, -0.89, 100, 0.05),
('WTIUSD', 'WTI Crude Oil', 'commodities', 78.25, 1.45, 100, 0.03),
('XPTUSD', 'Platinum', 'commodities', 945.60, 0.67, 50, 2.00),
('XPDUSD', 'Palladium', 'commodities', 1125.40, -1.23, 50, 3.00),
('NATGAS', 'Natural Gas', 'commodities', 2.875, 2.45, 100, 0.015),

-- Indices
('SPX500', 'S&P 500', 'indices', 4567.80, 0.78, 100, 0.75),
('NAS100', 'NASDAQ 100', 'indices', 15678.45, 1.23, 100, 1.25),
('DJ30', 'Dow Jones 30', 'indices', 35234.67, 0.45, 100, 2.50),
('GER40', 'Germany 40', 'indices', 16345.80, 0.89, 100, 1.80),
('UK100', 'UK 100', 'indices', 7654.32, -0.34, 100, 1.50),
('JPN225', 'Japan 225', 'indices', 33456.78, 1.67, 100, 5.00),
('AUS200', 'Australia 200', 'indices', 7234.56, 0.56, 100, 2.25),
('FRA40', 'France 40', 'indices', 7456.89, 0.23, 100, 1.75);

-- Enable realtime for all tables
ALTER TABLE public.user_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.assets REPLICA IDENTITY FULL;
ALTER TABLE public.trades REPLICA IDENTITY FULL;
ALTER TABLE public.user_favorites REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_favorites;