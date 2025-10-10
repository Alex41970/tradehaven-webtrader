-- Update contract sizes to industry standards

-- Forex pairs: 100,000 units per standard lot
UPDATE assets 
SET contract_size = 100000 
WHERE category = 'forex';

-- Gold: 100 troy ounces
UPDATE assets 
SET contract_size = 100 
WHERE symbol = 'XAUUSD';

-- Silver: 5,000 troy ounces
UPDATE assets 
SET contract_size = 5000 
WHERE symbol = 'XAGUSD';

-- Crude Oil (WTI & Brent): 1,000 barrels
UPDATE assets 
SET contract_size = 1000 
WHERE symbol IN ('WTIUSD', 'USOIL', 'UKOIL', 'BCOUSD');

-- Natural Gas: 10,000 MMBtu
UPDATE assets 
SET contract_size = 10000 
WHERE symbol IN ('NATGAS', 'NATGASUSD');

-- Copper: 25,000 pounds
UPDATE assets 
SET contract_size = 25000 
WHERE symbol IN ('COPPER', 'XCUUSD');

-- Palladium & Platinum: 100 troy ounces
UPDATE assets 
SET contract_size = 100 
WHERE symbol IN ('XPDUSD', 'XPTUSD');

-- Agricultural commodities: 5,000 bushels
UPDATE assets 
SET contract_size = 5000 
WHERE symbol IN ('CORN', 'WHEAT', 'SOYBEAN');

-- Coffee: 37,500 pounds
UPDATE assets 
SET contract_size = 37500 
WHERE symbol = 'COFFEE';

-- Sugar: 112,000 pounds
UPDATE assets 
SET contract_size = 112000 
WHERE symbol = 'SUGAR';

-- Cotton: 50,000 pounds
UPDATE assets 
SET contract_size = 50000 
WHERE symbol = 'COTTON';

-- Cocoa: 10 metric tons = 22,046 pounds
UPDATE assets 
SET contract_size = 22046 
WHERE symbol = 'COCOA';

-- Orange Juice: 15,000 pounds
UPDATE assets 
SET contract_size = 15000 
WHERE symbol = 'ORANGE';

-- Live Cattle: 40,000 pounds
UPDATE assets 
SET contract_size = 40000 
WHERE symbol = 'CATTLE';

-- Lean Hogs: 40,000 pounds
UPDATE assets 
SET contract_size = 40000 
WHERE symbol = 'HOGS';

-- Lumber: 110,000 board feet
UPDATE assets 
SET contract_size = 110000 
WHERE symbol = 'LUMBER';

-- Aluminum, Nickel, Zinc: 25 metric tons = 55,115 pounds
UPDATE assets 
SET contract_size = 55115 
WHERE symbol IN ('XALUSD', 'XNIUSD', 'XZNCUSD');

-- Crypto: 1 unit (keep as-is for Bitcoin, Ethereum, etc.)
UPDATE assets 
SET contract_size = 1 
WHERE category = 'crypto';

-- Stocks: 1 share (keep as-is)
UPDATE assets 
SET contract_size = 1 
WHERE category = 'stocks';

-- Indices: $1 per point (standard for CFD indices)
UPDATE assets 
SET contract_size = 1 
WHERE category = 'indices';