-- Force correct commodity prices immediately
UPDATE assets 
SET 
  price = 63.52,
  change_24h = 0.15,
  updated_at = now()
WHERE symbol = 'WTIUSD';

UPDATE assets 
SET 
  price = 73.85,
  change_24h = 0.25,
  updated_at = now()
WHERE symbol = 'BCOUSD';

UPDATE assets 
SET 
  price = 2.45,
  change_24h = 0.35,
  updated_at = now()
WHERE symbol = 'NATGAS';

UPDATE assets 
SET 
  price = 2662.34,
  change_24h = 0.10,
  updated_at = now()
WHERE symbol = 'XAUUSD';

UPDATE assets 
SET 
  price = 31.42,
  change_24h = -0.20,
  updated_at = now()
WHERE symbol = 'XAGUSD';

UPDATE assets 
SET 
  price = 965.00,
  change_24h = -0.10,
  updated_at = now()
WHERE symbol = 'XPTUSD';

UPDATE assets 
SET 
  price = 960.00,
  change_24h = 0.15,
  updated_at = now()
WHERE symbol = 'XPDUSD';