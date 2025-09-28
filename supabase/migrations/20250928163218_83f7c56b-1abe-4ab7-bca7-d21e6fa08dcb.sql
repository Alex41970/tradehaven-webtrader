-- Add 54 more trading assets to reach 100 total for comprehensive AllTick coverage

-- More Forex pairs (20 additional)
INSERT INTO assets (symbol, name, category, price, min_trade_size, max_leverage, base_currency, quote_currency, is_active) VALUES
('AUDCAD', 'Australian Dollar / Canadian Dollar', 'forex', 0.9200, 0.01, 500, 'AUD', 'CAD', true),
('AUDCHF', 'Australian Dollar / Swiss Franc', 'forex', 0.6500, 0.01, 500, 'AUD', 'CHF', true),
('AUDJPY', 'Australian Dollar / Japanese Yen', 'forex', 95.00, 0.01, 500, 'AUD', 'JPY', true),
('AUDNZD', 'Australian Dollar / New Zealand Dollar', 'forex', 1.1000, 0.01, 500, 'AUD', 'NZD', true),
('CADCHF', 'Canadian Dollar / Swiss Franc', 'forex', 0.7100, 0.01, 500, 'CAD', 'CHF', true),
('CADJPY', 'Canadian Dollar / Japanese Yen', 'forex', 103.50, 0.01, 500, 'CAD', 'JPY', true),
('CHFJPY', 'Swiss Franc / Japanese Yen', 'forex', 145.80, 0.01, 500, 'CHF', 'JPY', true),
('EURAUD', 'Euro / Australian Dollar', 'forex', 1.6200, 0.01, 500, 'EUR', 'AUD', true),
('EURCAD', 'Euro / Canadian Dollar', 'forex', 1.4700, 0.01, 500, 'EUR', 'CAD', true),
('EURCHF', 'Euro / Swiss Franc', 'forex', 0.9600, 0.01, 500, 'EUR', 'CHF', true),
('EURNZD', 'Euro / New Zealand Dollar', 'forex', 1.7800, 0.01, 500, 'EUR', 'NZD', true),
('GBPAUD', 'British Pound / Australian Dollar', 'forex', 1.9400, 0.01, 500, 'GBP', 'AUD', true),
('GBPCAD', 'British Pound / Canadian Dollar', 'forex', 1.7600, 0.01, 500, 'GBP', 'CAD', true),
('GBPCHF', 'British Pound / Swiss Franc', 'forex', 1.1500, 0.01, 500, 'GBP', 'CHF', true),
('GBPNZD', 'British Pound / New Zealand Dollar', 'forex', 2.1300, 0.01, 500, 'GBP', 'NZD', true),
('NZDCAD', 'New Zealand Dollar / Canadian Dollar', 'forex', 0.8400, 0.01, 500, 'NZD', 'CAD', true),
('NZDCHF', 'New Zealand Dollar / Swiss Franc', 'forex', 0.5900, 0.01, 500, 'NZD', 'CHF', true),
('NZDJPY', 'New Zealand Dollar / Japanese Yen', 'forex', 86.50, 0.01, 500, 'NZD', 'JPY', true),
('USDSEK', 'US Dollar / Swedish Krona', 'forex', 10.80, 0.01, 500, 'USD', 'SEK', true),
('USDNOK', 'US Dollar / Norwegian Krone', 'forex', 11.20, 0.01, 500, 'USD', 'NOK', true),

-- More Cryptocurrencies (10 additional)
('AVAXUSD', 'Avalanche', 'crypto', 42.00, 0.1, 50, 'AVAX', 'USD', true),
('ATOMUSD', 'Cosmos', 'crypto', 12.50, 0.1, 50, 'ATOM', 'USD', true),
('UNIUSD', 'Uniswap', 'crypto', 8.50, 0.1, 50, 'UNI', 'USD', true),
('ALGOUSD', 'Algorand', 'crypto', 0.35, 1, 50, 'ALGO', 'USD', true),
('APTUSD', 'Aptos', 'crypto', 15.80, 0.1, 50, 'APT', 'USD', true),
('NEARUSD', 'Near Protocol', 'crypto', 6.20, 0.1, 50, 'NEAR', 'USD', true),
('FTMUSD', 'Fantom', 'crypto', 0.75, 1, 50, 'FTM', 'USD', true),
('ICPUSD', 'Internet Computer', 'crypto', 14.20, 0.1, 50, 'ICP', 'USD', true),
('VETUSD', 'VeChain', 'crypto', 0.045, 10, 50, 'VET', 'USD', true),
('TRXUSD', 'Tron', 'crypto', 0.18, 5, 50, 'TRX', 'USD', true),

-- More Stocks (15 additional)
('TSMC', 'Taiwan Semiconductor', 'stocks', 120.50, 1, 10, null, 'USD', true),
('V', 'Visa Inc.', 'stocks', 285.40, 1, 10, null, 'USD', true),
('JPM', 'JPMorgan Chase & Co.', 'stocks', 195.30, 1, 10, null, 'USD', true),
('WMT', 'Walmart Inc.', 'stocks', 185.20, 1, 10, null, 'USD', true),
('PG', 'Procter & Gamble', 'stocks', 165.80, 1, 10, null, 'USD', true),
('JNJ', 'Johnson & Johnson', 'stocks', 155.70, 1, 10, null, 'USD', true),
('UNH', 'UnitedHealth Group', 'stocks', 520.40, 1, 10, null, 'USD', true),
('HD', 'Home Depot', 'stocks', 380.90, 1, 10, null, 'USD', true),
('MA', 'Mastercard Inc.', 'stocks', 425.60, 1, 10, null, 'USD', true),
('BAC', 'Bank of America', 'stocks', 42.30, 1, 10, null, 'USD', true),
('XOM', 'Exxon Mobil', 'stocks', 115.80, 1, 10, null, 'USD', true),
('LLY', 'Eli Lilly and Co', 'stocks', 780.20, 1, 10, null, 'USD', true),
('ABBV', 'AbbVie Inc.', 'stocks', 175.40, 1, 10, null, 'USD', true),
('KO', 'Coca-Cola Company', 'stocks', 62.80, 1, 10, null, 'USD', true),
('PEP', 'PepsiCo Inc.', 'stocks', 168.90, 1, 10, null, 'USD', true),

-- More Commodities (6 additional)  
('COPPER', 'Copper', 'commodities', 4.15, 0.01, 100, null, 'USD', true),
('COCOA', 'Cocoa', 'commodities', 7200.00, 0.01, 50, null, 'USD', true),
('COFFEE', 'Coffee', 'commodities', 180.50, 0.01, 50, null, 'USD', true),
('SUGAR', 'Sugar', 'commodities', 19.80, 0.01, 50, null, 'USD', true),
('COTTON', 'Cotton', 'commodities', 75.40, 0.01, 50, null, 'USD', true),
('WHEAT', 'Wheat', 'commodities', 550.00, 0.01, 50, null, 'USD', true),

-- More Indices (3 additional)
('HK50', 'Hong Kong 50', 'indices', 17500.00, 0.1, 100, null, 'HKD', true),
('CHINA50', 'China A50', 'indices', 12800.00, 0.1, 100, null, 'CNY', true),
('EUSTX50', 'EURO STOXX 50', 'indices', 4850.00, 0.1, 100, null, 'EUR', true);