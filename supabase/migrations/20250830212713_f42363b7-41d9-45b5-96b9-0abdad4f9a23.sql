-- Add comprehensive collection of popular trading assets
-- Cryptocurrencies (Popular ones missing)
INSERT INTO public.assets (symbol, name, category, price, change_24h, min_trade_size, max_leverage, spread, contract_size, base_currency, quote_currency) VALUES
-- Top Crypto Assets
('AVAXUSD', 'Avalanche', 'crypto', 35.42, -2.1, 0.01, 50, 0.02, 1, 'AVAX', 'USD'),
('DOGEUSD', 'Dogecoin', 'crypto', 0.085, 3.2, 10, 50, 0.0001, 1, 'DOGE', 'USD'),
('SHIBUSD', 'Shiba Inu', 'crypto', 0.0000089, 5.1, 100000, 50, 0.0000001, 1, 'SHIB', 'USD'),
('UNIUSD', 'Uniswap', 'crypto', 8.92, -1.8, 0.1, 50, 0.01, 1, 'UNI', 'USD'),
('TRXUSD', 'Tron', 'crypto', 0.162, 2.8, 10, 50, 0.001, 1, 'TRX', 'USD'),
('ATOMUSD', 'Cosmos', 'crypto', 6.74, -0.9, 1, 50, 0.01, 1, 'ATOM', 'USD'),
('NEARUSD', 'Near Protocol', 'crypto', 4.85, 1.2, 1, 50, 0.01, 1, 'NEAR', 'USD'),
('APTUSD', 'Aptos', 'crypto', 9.12, 2.1, 0.1, 50, 0.01, 1, 'APT', 'USD'),
('ARBUSD', 'Arbitrum', 'crypto', 0.78, -1.4, 1, 50, 0.01, 1, 'ARB', 'USD'),
('OPUSD', 'Optimism', 'crypto', 1.85, 0.8, 1, 50, 0.01, 1, 'OP', 'USD'),
('MATICUSD', 'Polygon', 'crypto', 0.425, 1.9, 10, 50, 0.001, 1, 'MATIC', 'USD'),
('PEPEUSD', 'Pepe', 'crypto', 0.0000087, 12.5, 100000, 50, 0.0000001, 1, 'PEPE', 'USD'),
('FLOKIUSD', 'Floki', 'crypto', 0.00013, 8.2, 10000, 50, 0.000001, 1, 'FLOKI', 'USD'),

-- Technology Stocks
('ADBE', 'Adobe Inc', 'stocks', 547.82, -0.8, 0.01, 10, 0.02, 1, 'ADBE', 'USD'),
('CRM', 'Salesforce Inc', 'stocks', 285.14, 1.2, 0.01, 10, 0.02, 1, 'CRM', 'USD'),
('ORCL', 'Oracle Corporation', 'stocks', 175.63, 0.5, 0.01, 10, 0.02, 1, 'ORCL', 'USD'),
('CSCO', 'Cisco Systems', 'stocks', 57.42, -0.3, 0.01, 10, 0.02, 1, 'CSCO', 'USD'),
('NVDA', 'NVIDIA Corporation', 'stocks', 875.30, 2.1, 0.01, 10, 0.02, 1, 'NVDA', 'USD'),
('META', 'Meta Platforms', 'stocks', 518.73, 1.8, 0.01, 10, 0.02, 1, 'META', 'USD'),

-- Financial Stocks
('JPM', 'JPMorgan Chase', 'stocks', 218.45, 0.9, 0.01, 10, 0.02, 1, 'JPM', 'USD'),
('BAC', 'Bank of America', 'stocks', 41.82, 1.1, 0.01, 10, 0.02, 1, 'BAC', 'USD'),
('WFC', 'Wells Fargo', 'stocks', 63.27, 0.7, 0.01, 10, 0.02, 1, 'WFC', 'USD'),

-- Consumer Stocks
('KO', 'Coca-Cola Company', 'stocks', 62.18, 0.2, 0.01, 10, 0.02, 1, 'KO', 'USD'),
('MCD', 'McDonalds Corporation', 'stocks', 295.84, -0.1, 0.01, 10, 0.02, 1, 'MCD', 'USD'),
('WMT', 'Walmart Inc', 'stocks', 85.92, 0.4, 0.01, 10, 0.02, 1, 'WMT', 'USD'),
('PG', 'Procter & Gamble', 'stocks', 167.43, -0.2, 0.01, 10, 0.02, 1, 'PG', 'USD'),

-- Healthcare Stocks
('JNJ', 'Johnson & Johnson', 'stocks', 155.82, 0.3, 0.01, 10, 0.02, 1, 'JNJ', 'USD'),
('PFE', 'Pfizer Inc', 'stocks', 25.73, -1.2, 0.01, 10, 0.02, 1, 'PFE', 'USD'),
('UNH', 'UnitedHealth Group', 'stocks', 563.84, 0.8, 0.01, 10, 0.02, 1, 'UNH', 'USD'),

-- Energy Stocks
('XOM', 'Exxon Mobil', 'stocks', 117.45, 1.4, 0.01, 10, 0.02, 1, 'XOM', 'USD'),
('CVX', 'Chevron Corporation', 'stocks', 159.28, 0.9, 0.01, 10, 0.02, 1, 'CVX', 'USD'),

-- Exotic Forex Pairs
('USDTRY', 'US Dollar / Turkish Lira', 'forex', 34.2150, 0.8, 1000, 400, 15, 100000, 'USD', 'TRY'),
('USDZAR', 'US Dollar / South African Rand', 'forex', 18.4523, -0.5, 1000, 200, 8, 100000, 'USD', 'ZAR'),
('USDMXN', 'US Dollar / Mexican Peso', 'forex', 17.1245, 0.3, 1000, 200, 5, 100000, 'USD', 'MXN'),
('USDSGD', 'US Dollar / Singapore Dollar', 'forex', 1.3245, 0.1, 1000, 200, 3, 100000, 'USD', 'SGD'),
('USDNOK', 'US Dollar / Norwegian Krone', 'forex', 10.8532, -0.2, 1000, 200, 4, 100000, 'USD', 'NOK'),
('USDSEK', 'US Dollar / Swedish Krona', 'forex', 10.4521, 0.2, 1000, 200, 4, 100000, 'USD', 'SEK'),
('CADJPY', 'Canadian Dollar / Japanese Yen', 'forex', 109.845, 0.4, 1000, 200, 3, 100000, 'CAD', 'JPY'),
('AUDJPY', 'Australian Dollar / Japanese Yen', 'forex', 97.523, -0.3, 1000, 200, 3, 100000, 'AUD', 'JPY'),
('NZDJPY', 'New Zealand Dollar / Japanese Yen', 'forex', 90.142, 0.1, 1000, 200, 3, 100000, 'NZD', 'JPY'),

-- Additional Major Indices
('EU50', 'Euro Stoxx 50', 'indices', 4875.32, 0.8, 0.1, 100, 1, 10, 'EU50', 'EUR'),
('ITA40', 'FTSE MIB', 'indices', 34250.15, 1.2, 0.1, 100, 3, 10, 'ITA40', 'EUR'),
('SPA35', 'IBEX 35', 'indices', 11485.75, 0.5, 0.1, 100, 2, 10, 'SPA35', 'EUR'),
('HK50', 'Hang Seng', 'indices', 17425.84, -0.9, 0.1, 100, 3, 10, 'HK50', 'HKD'),
('CHN50', 'Shanghai Composite', 'indices', 2975.43, 1.1, 0.1, 100, 2, 10, 'CHN50', 'CNY'),
('US2000', 'Russell 2000', 'indices', 2185.67, 0.7, 0.1, 100, 1, 10, 'US2000', 'USD'),
('CAN60', 'TSX Composite', 'indices', 22850.45, 0.3, 0.1, 100, 2, 10, 'CAN60', 'CAD'),
('VIX', 'Volatility Index', 'indices', 14.25, -5.2, 0.1, 50, 0.1, 1000, 'VIX', 'USD'),

-- Agricultural Commodities
('WHEAT', 'Wheat', 'commodities', 545.25, 1.8, 1, 50, 2, 5000, 'WHEAT', 'USD'),
('CORN', 'Corn', 'commodities', 428.75, -0.9, 1, 50, 2, 5000, 'CORN', 'USD'),
('SOYBEANS', 'Soybeans', 'commodities', 1185.50, 2.1, 1, 50, 5, 5000, 'SOYBEANS', 'USD'),
('SUGAR', 'Sugar', 'commodities', 19.85, 1.4, 10, 50, 0.1, 112000, 'SUGAR', 'USD'),
('COFFEE', 'Coffee', 'commodities', 248.75, -1.2, 5, 50, 1, 37500, 'COFFEE', 'USD'),
('COTTON', 'Cotton', 'commodities', 72.45, 0.8, 5, 50, 0.5, 50000, 'COTTON', 'USD'),

-- Additional Metals
('COPPER', 'Copper', 'commodities', 4.185, 1.5, 1, 50, 0.01, 25000, 'COPPER', 'USD'),
('ALUMINUM', 'Aluminum', 'commodities', 2.145, 0.7, 5, 50, 0.01, 25000, 'ALUMINUM', 'USD'),
('ZINC', 'Zinc', 'commodities', 2.825, -0.4, 5, 50, 0.01, 25000, 'ZINC', 'USD'),

-- Energy Commodities
('NATGAS', 'Natural Gas', 'commodities', 2.485, 3.2, 1, 50, 0.01, 10000, 'NATGAS', 'USD'),
('HEATING', 'Heating Oil', 'commodities', 2.685, 1.8, 1, 50, 0.01, 42000, 'HEATING', 'USD'),
('GASOLINE', 'Gasoline', 'commodities', 2.325, 2.1, 1, 50, 0.01, 42000, 'GASOLINE', 'USD');