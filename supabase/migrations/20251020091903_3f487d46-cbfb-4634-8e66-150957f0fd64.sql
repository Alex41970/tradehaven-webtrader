-- Activate all forex pairs (currently all inactive)
UPDATE assets 
SET is_active = true, 
    updated_at = now()
WHERE category = 'forex';

-- Activate all commodities (Gold, Silver, Oil, Natural Gas)
UPDATE assets 
SET is_active = true,
    updated_at = now()
WHERE category = 'commodity';

-- Activate all major indices (SPX500, NAS100, US30, etc.)
UPDATE assets 
SET is_active = true,
    updated_at = now()
WHERE category = 'index';

-- Activate quality stocks (major tech, finance, consumer stocks)
UPDATE assets 
SET is_active = true,
    updated_at = now()
WHERE category = 'stock' AND symbol IN (
  'AAPLUSD', 'GOOGLUSD', 'MSFTUSD', 'AMZNUSD', 'TSLAUSD', 
  'NVDAUSD', 'METAUSD', 'JPMUSD', 'VWALMTUSD', 'JNJUSD',
  'PGUSD', 'KOUSD', 'DISUSD', 'MAUSD', 'BAUSD',
  'MCDUSD', 'NIKELUSD', 'NFLXUSD', 'ADBUSD', 'PFELUSD'
);