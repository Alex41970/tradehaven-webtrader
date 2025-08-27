-- Insert sample trading assets with realistic data
INSERT INTO public.assets (symbol, name, category, price, change_24h, min_trade_size, max_leverage, spread) VALUES 

-- Forex pairs
('EURUSD', 'Euro / US Dollar', 'forex', 1.08450, -0.00125, 1000, 500, 0.00001),
('GBPUSD', 'British Pound / US Dollar', 'forex', 1.26780, 0.00340, 1000, 500, 0.00001),
('USDJPY', 'US Dollar / Japanese Yen', 'forex', 149.850, 0.125, 1000, 500, 0.001),
('USDCHF', 'US Dollar / Swiss Franc', 'forex', 0.88920, -0.00180, 1000, 500, 0.00001),
('AUDUSD', 'Australian Dollar / US Dollar', 'forex', 0.65430, 0.00220, 1000, 500, 0.00001),
('USDCAD', 'US Dollar / Canadian Dollar', 'forex', 1.37250, -0.00095, 1000, 500, 0.00001),
('NZDUSD', 'New Zealand Dollar / US Dollar', 'forex', 0.59180, 0.00150, 1000, 500, 0.00001),

-- Major Cryptocurrencies
('BTCUSD', 'Bitcoin', 'crypto', 43250.50, 1250.75, 0.001, 125, 0.01),
('ETHUSD', 'Ethereum', 'crypto', 2380.25, 85.50, 0.01, 125, 0.01),
('XRPUSD', 'Ripple', 'crypto', 0.6125, 0.0285, 1, 100, 0.0001),
('ADAUSD', 'Cardano', 'crypto', 0.4850, 0.0125, 1, 100, 0.0001),
('DOTUSD', 'Polkadot', 'crypto', 5.875, 0.225, 0.1, 100, 0.001),

-- Major US Stocks
('AAPL', 'Apple Inc.', 'stocks', 189.75, 2.85, 1, 20, 0.01),
('GOOGL', 'Alphabet Inc.', 'stocks', 138.25, -1.45, 1, 20, 0.01),
('TSLA', 'Tesla Inc.', 'stocks', 248.50, 8.75, 1, 20, 0.01),
('MSFT', 'Microsoft Corporation', 'stocks', 378.25, 4.50, 1, 20, 0.01),
('AMZN', 'Amazon.com Inc.', 'stocks', 146.80, -2.15, 1, 20, 0.01),

-- Precious Metals & Commodities
('XAUUSD', 'Gold', 'commodities', 2025.50, 12.75, 0.01, 100, 0.05),
('XAGUSD', 'Silver', 'commodities', 24.85, 0.35, 0.1, 100, 0.002),
('WTIUSD', 'Crude Oil WTI', 'commodities', 78.25, -1.85, 0.1, 100, 0.01),
('BCOUSD', 'Brent Oil', 'commodities', 82.50, -1.25, 0.1, 100, 0.01),

-- Major Indices
('US30', 'Dow Jones Industrial Average', 'indices', 37850.25, 125.75, 0.1, 100, 0.5),
('SPX500', 'S&P 500 Index', 'indices', 4785.50, 28.25, 0.1, 100, 0.2),
('NAS100', 'NASDAQ 100 Index', 'indices', 16425.75, 85.50, 0.1, 100, 0.5),
('UK100', 'FTSE 100 Index', 'indices', 7485.25, -15.75, 0.1, 100, 0.5),
('GER40', 'DAX Index', 'indices', 16950.50, 45.25, 0.1, 100, 0.5)

ON CONFLICT (symbol) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  change_24h = EXCLUDED.change_24h,
  min_trade_size = EXCLUDED.min_trade_size,
  max_leverage = EXCLUDED.max_leverage,
  spread = EXCLUDED.spread,
  updated_at = now();