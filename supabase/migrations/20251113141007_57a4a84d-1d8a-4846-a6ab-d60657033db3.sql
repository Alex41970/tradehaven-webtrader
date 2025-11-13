-- Enable Realtime on assets table for live price updates
ALTER TABLE assets REPLICA IDENTITY FULL;

-- Check if the table is already in the publication before adding it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'assets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE assets;
  END IF;
END $$;

-- Add performance indexes for price updates
CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets(symbol);
CREATE INDEX IF NOT EXISTS idx_assets_price_updated ON assets(last_ws_update DESC);
CREATE INDEX IF NOT EXISTS idx_assets_price_source ON assets(price_source);

-- Update all assets to indicate Twelve Data as the price source
UPDATE assets SET price_source = 'twelve_data' WHERE price_source IS NULL OR price_source = 'pending';

-- Add comment
COMMENT ON COLUMN assets.price_source IS 'Source of price data: twelve_data';
COMMENT ON COLUMN assets.last_ws_update IS 'Timestamp of last WebSocket price update from Twelve Data';