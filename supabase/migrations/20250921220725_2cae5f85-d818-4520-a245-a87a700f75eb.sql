-- Create table for 24h price history snapshots
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  price NUMERIC NOT NULL,
  change_24h NUMERIC NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(symbol, snapshot_date)
);

-- Enable RLS
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing price history
CREATE POLICY "Price history is viewable by everyone" ON public.price_history
FOR SELECT USING (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_price_history_symbol_date ON public.price_history(symbol, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON public.price_history(snapshot_date DESC);