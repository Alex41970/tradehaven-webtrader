-- Set 100x max leverage for all asset types
UPDATE public.assets 
SET max_leverage = 100
WHERE max_leverage != 100;