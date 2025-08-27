-- Update asset prices to current market values (December 2024)
UPDATE public.assets SET 
  price = CASE 
    -- Crypto prices
    WHEN symbol = 'BTCUSD' THEN 112250.00
    WHEN symbol = 'ETHUSD' THEN 3450.50
    WHEN symbol = 'XRPUSD' THEN 0.62
    WHEN symbol = 'ADAUSD' THEN 0.48
    WHEN symbol = 'DOTUSD' THEN 6.85
    WHEN symbol = 'BNBUSD' THEN 715.80
    WHEN symbol = 'LINKUSD' THEN 25.40
    WHEN symbol = 'LTCUSD' THEN 108.90
    WHEN symbol = 'MATICUSD' THEN 0.52
    WHEN symbol = 'SOLUSD' THEN 245.60
    
    -- Forex rates (current as of Dec 2024)
    WHEN symbol = 'EURUSD' THEN 1.0485
    WHEN symbol = 'GBPUSD' THEN 1.2545
    WHEN symbol = 'AUDUSD' THEN 0.6285
    WHEN symbol = 'NZDUSD' THEN 0.5645
    WHEN symbol = 'USDCAD' THEN 1.4385
    WHEN symbol = 'USDCHF' THEN 0.9045
    WHEN symbol = 'USDJPY' THEN 152.85
    WHEN symbol = 'EURGBP' THEN 0.8355
    WHEN symbol = 'EURJPY' THEN 160.25
    WHEN symbol = 'GBPJPY' THEN 191.85
    
    -- Commodities (current Dec 2024)
    WHEN symbol = 'XAUUSD' THEN 2632.50
    WHEN symbol = 'XAGUSD' THEN 30.25
    WHEN symbol = 'WTIUSD' THEN 68.85
    WHEN symbol = 'BCOUSD' THEN 72.45
    WHEN symbol = 'NATGAS' THEN 3.15
    WHEN symbol = 'XPTUSD' THEN 925.00
    WHEN symbol = 'XPDUSD' THEN 980.00
    
    -- Indices (current Dec 2024)
    WHEN symbol = 'SPX500' THEN 6090.00
    WHEN symbol = 'DJ30' THEN 44850.00
    WHEN symbol = 'NAS100' THEN 20120.00
    WHEN symbol = 'GER40' THEN 20385.00
    WHEN symbol = 'UK100' THEN 8285.00
    WHEN symbol = 'FRA40' THEN 7485.00
    WHEN symbol = 'JPN225' THEN 39580.00
    WHEN symbol = 'AUS200' THEN 8285.00
    ELSE price -- Keep existing price if symbol not matched
  END,
  change_24h = 0.00, -- Reset 24h changes
  updated_at = now()
WHERE symbol IN (
  'BTCUSD', 'ETHUSD', 'XRPUSD', 'ADAUSD', 'DOTUSD', 'BNBUSD', 'LINKUSD', 'LTCUSD', 'MATICUSD', 'SOLUSD',
  'EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF', 'USDJPY', 'EURGBP', 'EURJPY', 'GBPJPY',
  'XAUUSD', 'XAGUSD', 'WTIUSD', 'BCOUSD', 'NATGAS', 'XPTUSD', 'XPDUSD',
  'SPX500', 'DJ30', 'NAS100', 'GER40', 'UK100', 'FRA40', 'JPN225', 'AUS200'
);