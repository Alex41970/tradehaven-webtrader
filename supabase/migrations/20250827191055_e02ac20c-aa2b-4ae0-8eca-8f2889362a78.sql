-- Add forex lot size and currency information to assets table
ALTER TABLE public.assets 
ADD COLUMN contract_size INTEGER DEFAULT 1,
ADD COLUMN base_currency TEXT,
ADD COLUMN quote_currency TEXT;

-- Update forex pairs with appropriate contract sizes and currencies
-- Major forex pairs (100,000 contract size)
UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'EUR',
  quote_currency = 'USD'
WHERE symbol = 'EURUSD';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'GBP',
  quote_currency = 'USD'
WHERE symbol = 'GBPUSD';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'USD',
  quote_currency = 'CHF'
WHERE symbol = 'USDCHF';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'AUD',
  quote_currency = 'USD'
WHERE symbol = 'AUDUSD';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'USD',
  quote_currency = 'CAD'
WHERE symbol = 'USDCAD';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'NZD',
  quote_currency = 'USD'
WHERE symbol = 'NZDUSD';

-- JPY pairs (100,000 contract size but JPY is quote currency)
UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'USD',
  quote_currency = 'JPY'
WHERE symbol = 'USDJPY';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'EUR',
  quote_currency = 'JPY'
WHERE symbol = 'EURJPY';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'GBP',
  quote_currency = 'JPY'
WHERE symbol = 'GBPJPY';

-- Set default contract size of 1 for non-forex assets (stocks, crypto, commodities, indices)
UPDATE public.assets 
SET contract_size = 1
WHERE category != 'forex';