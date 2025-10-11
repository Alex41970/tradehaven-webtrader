-- Phase 1: Remove all non-crypto assets and their related data
-- This migration deletes commodities, forex, stocks, and indices, leaving only cryptocurrency assets

-- Step 1: Delete trade execution logs for non-crypto trades
DELETE FROM trade_execution_log 
WHERE trade_id IN (
  SELECT t.id FROM trades t
  JOIN assets a ON t.asset_id = a.id
  WHERE a.category IN ('commodities', 'forex', 'stocks', 'indices')
);

-- Step 2: Delete trades for non-crypto assets
DELETE FROM trades 
WHERE asset_id IN (
  SELECT id FROM assets WHERE category IN ('commodities', 'forex', 'stocks', 'indices')
);

-- Step 3: Delete any user favorites for non-crypto assets
DELETE FROM user_favorites
WHERE asset_id IN (
  SELECT id FROM assets WHERE category IN ('commodities', 'forex', 'stocks', 'indices')
);

-- Step 4: Delete all non-crypto assets
DELETE FROM assets WHERE category IN ('commodities', 'forex', 'stocks', 'indices');

-- Step 5: Delete any orphaned price history for deleted assets
DELETE FROM price_history 
WHERE symbol NOT IN (SELECT symbol FROM assets WHERE category = 'crypto');

-- Step 6: Remove AllTick cron job if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-prices-from-alltick') THEN
    PERFORM cron.unschedule('update-prices-from-alltick');
    RAISE NOTICE 'Removed AllTick cron job';
  END IF;
END $$;

-- Step 7: Verify only crypto assets remain
DO $$
DECLARE
  crypto_count INTEGER;
  other_count INTEGER;
  trades_count INTEGER;
  logs_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO crypto_count FROM assets WHERE category = 'crypto';
  SELECT COUNT(*) INTO other_count FROM assets WHERE category != 'crypto';
  SELECT COUNT(*) INTO trades_count FROM trades;
  SELECT COUNT(*) INTO logs_count FROM trade_execution_log;
  
  RAISE NOTICE 'Crypto assets remaining: %', crypto_count;
  RAISE NOTICE 'Non-crypto assets remaining: %', other_count;
  RAISE NOTICE 'Total trades remaining: %', trades_count;
  RAISE NOTICE 'Total execution logs remaining: %', logs_count;
  
  IF other_count > 0 THEN
    RAISE EXCEPTION 'Failed to remove all non-crypto assets';
  END IF;
  
  IF crypto_count = 0 THEN
    RAISE EXCEPTION 'No crypto assets found - something went wrong';
  END IF;
  
  RAISE NOTICE '✅ SUCCESS: Platform is now crypto-only with % assets', crypto_count;
END $$;