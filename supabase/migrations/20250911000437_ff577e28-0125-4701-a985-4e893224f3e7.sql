-- Force update XPTUSD to correct price and stop it from being overwritten
UPDATE assets SET 
  price = 91.00,
  change_24h = 0.00,
  updated_at = now()
WHERE symbol = 'XPTUSD';