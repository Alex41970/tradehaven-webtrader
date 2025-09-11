-- Update commodity prices to current market values
UPDATE assets SET 
  price = 63.52,
  change_24h = 0.00,
  updated_at = now()
WHERE symbol = 'WTIUSD';

UPDATE assets SET 
  price = 2662.34,
  change_24h = 0.00,
  updated_at = now()
WHERE symbol = 'XAUUSD';

UPDATE assets SET 
  price = 31.42,
  change_24h = 0.00,
  updated_at = now()
WHERE symbol = 'XAGUSD';

UPDATE assets SET 
  price = 965.00,
  change_24h = 0.00,
  updated_at = now()
WHERE symbol = 'XPTUSD';

UPDATE assets SET 
  price = 960.00,
  change_24h = 0.00,
  updated_at = now()
WHERE symbol = 'XPDUSD';

UPDATE assets SET 
  price = 3.15,
  change_24h = 0.00,
  updated_at = now()
WHERE symbol = 'NATGAS';

UPDATE assets SET 
  price = 66.84,
  change_24h = 0.00,
  updated_at = now()
WHERE symbol = 'BCOUSD';