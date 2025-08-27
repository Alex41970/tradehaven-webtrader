-- Fix EURGBP forex pair to have correct contract_size, base_currency, and quote_currency
UPDATE assets 
SET 
  contract_size = 100000,
  base_currency = 'EUR',
  quote_currency = 'GBP'
WHERE symbol = 'EURGBP' AND category = 'forex';