-- Add API source and symbol mapping columns to assets table
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS api_source TEXT DEFAULT 'yahoo',
ADD COLUMN IF NOT EXISTS api_symbol TEXT;

-- Update crypto assets to use Binance
UPDATE assets 
SET 
  api_source = 'binance',
  api_symbol = LOWER(REPLACE(symbol, 'USD', '')) || 'usdt'
WHERE category = 'crypto' AND symbol LIKE '%USD';

-- Update forex assets to use Yahoo Finance format
UPDATE assets 
SET 
  api_source = 'yahoo',
  api_symbol = CASE 
    WHEN symbol = 'USDJPY' THEN 'JPY=X'
    WHEN symbol = 'USDCHF' THEN 'CHF=X'
    WHEN symbol = 'USDCAD' THEN 'CAD=X'
    WHEN symbol = 'USDMXN' THEN 'MXN=X'
    WHEN symbol = 'USDZAR' THEN 'ZAR=X'
    WHEN symbol = 'USDHKD' THEN 'HKD=X'
    WHEN symbol = 'USDSGD' THEN 'SGD=X'
    WHEN symbol = 'USDNOK' THEN 'NOK=X'
    WHEN symbol = 'USDSEK' THEN 'SEK=X'
    WHEN symbol = 'USDDKK' THEN 'DKK=X'
    ELSE symbol || '=X'
  END
WHERE category = 'forex';

-- Update stock assets (symbol stays the same)
UPDATE assets 
SET 
  api_source = 'yahoo',
  api_symbol = symbol
WHERE category = 'stocks';

-- Update indices to use Yahoo Finance format
UPDATE assets 
SET 
  api_source = 'yahoo',
  api_symbol = CASE 
    WHEN symbol = 'US30' THEN '^DJI'
    WHEN symbol = 'US100' THEN '^IXIC'
    WHEN symbol = 'US500' THEN '^GSPC'
    WHEN symbol = 'UK100' THEN '^FTSE'
    WHEN symbol = 'GER40' THEN '^GDAXI'
    WHEN symbol = 'FRA40' THEN '^FCHI'
    WHEN symbol = 'JPN225' THEN '^N225'
    WHEN symbol = 'AUS200' THEN '^AXJO'
    ELSE symbol
  END
WHERE category = 'indices';

-- Update commodities to use Yahoo Finance futures format
UPDATE assets 
SET 
  api_source = 'yahoo',
  api_symbol = CASE 
    WHEN symbol = 'XAUUSD' THEN 'GC=F'
    WHEN symbol = 'XAGUSD' THEN 'SI=F'
    WHEN symbol = 'WTIUSD' THEN 'CL=F'
    WHEN symbol = 'BRENTUSD' THEN 'BZ=F'
    WHEN symbol = 'NGAS' THEN 'NG=F'
    WHEN symbol = 'COPPER' THEN 'HG=F'
    ELSE symbol
  END
WHERE category = 'commodities';

-- Update price_source to reflect new multi-source system
UPDATE assets 
SET price_source = CASE 
  WHEN api_source = 'binance' THEN 'binance_websocket'
  WHEN api_source = 'yahoo' THEN 'yahoo_finance'
  ELSE 'free_api'
END;