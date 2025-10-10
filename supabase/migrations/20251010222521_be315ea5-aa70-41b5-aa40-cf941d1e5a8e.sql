-- Mark assets NOT in the top 100 AllTick symbols as inactive
-- Add columns to track AllTick support

-- Add new columns to assets table
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS alltick_code TEXT,
ADD COLUMN IF NOT EXISTS alltick_supported BOOLEAN DEFAULT true;

-- Mark only the top 100 trading assets as active
-- All others will be marked as inactive

-- Update assets to mark most as inactive initially
UPDATE assets SET is_active = false;

-- Now mark the top 100 as active based on our symbol mapping
-- FOREX (30)
UPDATE assets SET is_active = true, alltick_code = symbol, alltick_supported = true
WHERE symbol IN (
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY', 'GBPCHF', 'AUDNZD',
  'NZDJPY', 'GBPAUD', 'GBPNZD', 'EURAUD', 'EURNZD', 'AUDCAD', 'GBPCAD',
  'EURCAD', 'CADJPY', 'AUDCHF', 'CADCHF', 'NZDCAD', 'NZDCHF', 'CHFJPY',
  'USDMXN', 'USDZAR'
);

-- CRYPTO (30) - map to USDT pairs for AllTick
UPDATE assets SET is_active = true, alltick_code = symbol || 'T', alltick_supported = true
WHERE symbol IN (
  'BTCUSD', 'ETHUSD', 'BNBUSD', 'ADAUSD', 'SOLUSD', 'XRPUSD', 'DOTUSD',
  'DOGEUSD', 'AVAXUSD', 'MATICUSD', 'LINKUSD', 'LTCUSD', 'UNIUSD',
  'ATOMUSD', 'ETCUSD', 'XLMUSD', 'FILUSD', 'TRXUSD', 'APTUSD', 'NEARUSD',
  'ALGOUSD', 'EOSUSD', 'XTZUSD', 'AAVEUSD', 'GRTUSD', 'SANDUSD', 'MANAUSD',
  'ICPUSD', 'INJUSD', 'RNDRUSD'
);

-- Fix crypto codes to use USDT format
UPDATE assets SET alltick_code = REPLACE(symbol, 'USD', 'USDT')
WHERE symbol LIKE '%USD' AND category = 'crypto' AND is_active = true;

-- COMMODITIES (15)
UPDATE assets SET is_active = true, alltick_supported = true
WHERE symbol IN ('XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD', 'WTIUSD', 'GASUSD');

UPDATE assets SET is_active = true, alltick_code = 'BRUSD', alltick_supported = true
WHERE symbol IN ('BCOUSD', 'UKOUSD');

UPDATE assets SET is_active = true, alltick_code = 'WTIUSD', alltick_supported = true
WHERE symbol = 'USOIL';

UPDATE assets SET is_active = true, alltick_supported = true
WHERE symbol IN ('CORNUSD', 'WHEATUSD', 'SOYUSD', 'COTUSD', 'SUGUSD', 'COFUSD');

-- STOCKS (20) - add .US suffix for AllTick
UPDATE assets SET is_active = true, alltick_code = symbol || '.US', alltick_supported = true
WHERE symbol IN (
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'BRK.B',
  'JPM', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'HD', 'DIS', 'NFLX', 'PYPL',
  'INTC', 'AMD'
);

-- INDICES (5) - add .IDX suffix for AllTick
UPDATE assets SET is_active = true, alltick_code = symbol || '.IDX', alltick_supported = true
WHERE symbol IN ('SPX500', 'NAS100', 'US30', 'UK100', 'JPN225');

-- Create index on alltick_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_assets_alltick_code ON assets(alltick_code);

-- Log the counts
DO $$
DECLARE
  active_count INT;
  inactive_count INT;
BEGIN
  SELECT COUNT(*) INTO active_count FROM assets WHERE is_active = true;
  SELECT COUNT(*) INTO inactive_count FROM assets WHERE is_active = false;
  
  RAISE NOTICE '✅ Updated assets table:';
  RAISE NOTICE '  - Active (AllTick supported): % assets', active_count;
  RAISE NOTICE '  - Inactive: % assets', inactive_count;
  RAISE NOTICE '  - Total: % assets', (active_count + inactive_count);
END $$;