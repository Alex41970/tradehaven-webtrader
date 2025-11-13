-- Remove AllTick-specific columns and add new price source tracking
ALTER TABLE assets 
  DROP COLUMN IF EXISTS alltick_code,
  DROP COLUMN IF EXISTS alltick_supported,
  ADD COLUMN IF NOT EXISTS price_source text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_ws_update timestamp with time zone DEFAULT now();

-- Add index for faster price queries
CREATE INDEX IF NOT EXISTS idx_assets_last_ws_update ON assets(last_ws_update);

-- Add comment for clarity
COMMENT ON COLUMN assets.price_source IS 'Source of price data: twelve_data, fallback, pending';
COMMENT ON COLUMN assets.last_ws_update IS 'Timestamp of last WebSocket price update';