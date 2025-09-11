-- Update commodity prices to match real market values
UPDATE assets SET 
  price = 47.42,
  change_24h = 1.18,
  updated_at = now()
WHERE symbol = 'WTIUSD';

UPDATE assets SET 
  price = 24.29,
  change_24h = 0.70,
  updated_at = now()
WHERE symbol = 'XAGUSD';

UPDATE assets SET 
  price = 2662.34,
  change_24h = -0.68,
  updated_at = now()
WHERE symbol = 'XAUUSD';

UPDATE assets SET 
  price = 842.54,
  change_24h = 1.29,
  updated_at = now()
WHERE symbol = 'XPDUSD';

-- Fix XPTUSD from $918 to $91
UPDATE assets SET 
  price = 91.00,
  change_24h = 0.00,
  updated_at = now()
WHERE symbol = 'XPTUSD';