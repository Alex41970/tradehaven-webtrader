-- Phase B: Delete all non-crypto assets and related data
-- This ensures the platform is strictly crypto-only

-- Step 1: Cancel all open trade orders for non-crypto assets
UPDATE trade_orders
SET status = 'cancelled'
WHERE asset_id IN (
  SELECT id FROM assets WHERE category != 'crypto'
) AND status = 'pending';

-- Step 2: Delete all non-crypto assets (trades will be handled by cascade or remain for historical purposes)
-- Note: We keep closed trades for historical records, but remove the ability to trade non-crypto
DELETE FROM assets
WHERE category IN ('forex', 'stocks', 'commodities', 'indices');

-- Step 3: Remove orphaned price history for non-crypto symbols
DELETE FROM price_history
WHERE symbol NOT IN (
  SELECT symbol FROM assets WHERE category = 'crypto'
);

-- Verification: Ensure only crypto assets remain
DO $$
DECLARE
  crypto_count INTEGER;
  non_crypto_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO crypto_count FROM assets WHERE category = 'crypto';
  SELECT COUNT(*) INTO non_crypto_count FROM assets WHERE category != 'crypto';
  
  RAISE NOTICE 'Migration complete: % crypto assets remaining, % non-crypto assets removed', crypto_count, non_crypto_count;
  
  IF non_crypto_count > 0 THEN
    RAISE EXCEPTION 'Non-crypto assets still exist after migration!';
  END IF;
END $$;