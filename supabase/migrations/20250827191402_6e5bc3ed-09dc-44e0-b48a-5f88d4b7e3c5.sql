-- Update forex pairs with appropriate contract sizes and currencies
-- Major forex pairs (100,000 contract size)
UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'EUR',
  quote_currency = 'USD'
WHERE symbol = 'EURUSD' AND category = 'forex';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'GBP',
  quote_currency = 'USD'
WHERE symbol = 'GBPUSD' AND category = 'forex';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'USD',
  quote_currency = 'CHF'
WHERE symbol = 'USDCHF' AND category = 'forex';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'AUD',
  quote_currency = 'USD'
WHERE symbol = 'AUDUSD' AND category = 'forex';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'USD',
  quote_currency = 'CAD'
WHERE symbol = 'USDCAD' AND category = 'forex';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'NZD',
  quote_currency = 'USD'
WHERE symbol = 'NZDUSD' AND category = 'forex';

-- JPY pairs (100,000 contract size)
UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'USD',
  quote_currency = 'JPY'
WHERE symbol = 'USDJPY' AND category = 'forex';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'EUR',
  quote_currency = 'JPY'
WHERE symbol = 'EURJPY' AND category = 'forex';

UPDATE public.assets 
SET 
  contract_size = 100000,
  base_currency = 'GBP',
  quote_currency = 'JPY'
WHERE symbol = 'GBPJPY' AND category = 'forex';

-- Set default contract size of 1 for non-forex assets
UPDATE public.assets 
SET contract_size = 1
WHERE category != 'forex' AND contract_size IS NULL;