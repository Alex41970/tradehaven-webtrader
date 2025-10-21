-- Insert 47 new assets (forex, commodities, indices, stocks) with plural categories
-- Uses UPSERT pattern for idempotency and to activate/update existing rows

WITH new_assets AS (
  SELECT * FROM (VALUES
    -- Forex (20 pairs) - category: 'forex'
    ('EURUSD','Euro / US Dollar','forex',1.0850,0.00,true,0.01,500,0.00010,100000,'EUR','USD','forex.em/EURUSD'),
    ('GBPUSD','British Pound / US Dollar','forex',1.2650,0.00,true,0.01,500,0.00012,100000,'GBP','USD','forex.em/GBPUSD'),
    ('USDJPY','US Dollar / Japanese Yen','forex',149.80,0.00,true,0.01,500,0.01000,100000,'USD','JPY','forex.em/USDJPY'),
    ('USDCHF','US Dollar / Swiss Franc','forex',0.8740,0.00,true,0.01,500,0.00010,100000,'USD','CHF','forex.em/USDCHF'),
    ('AUDUSD','Australian Dollar / US Dollar','forex',0.6530,0.00,true,0.01,500,0.00012,100000,'AUD','USD','forex.em/AUDUSD'),
    ('USDCAD','US Dollar / Canadian Dollar','forex',1.3720,0.00,true,0.01,500,0.00012,100000,'USD','CAD','forex.em/USDCAD'),
    ('NZDUSD','New Zealand Dollar / US Dollar','forex',0.5910,0.00,true,0.01,500,0.00012,100000,'NZD','USD','forex.em/NZDUSD'),
    ('EURGBP','Euro / British Pound','forex',0.8570,0.00,true,0.01,400,0.00010,100000,'EUR','GBP','forex.em/EURGBP'),
    ('EURJPY','Euro / Japanese Yen','forex',162.40,0.00,true,0.01,400,0.01000,100000,'EUR','JPY','forex.em/EURJPY'),
    ('GBPJPY','British Pound / Japanese Yen','forex',189.70,0.00,true,0.01,400,0.01000,100000,'GBP','JPY','forex.em/GBPJPY'),
    ('EURAUD','Euro / Australian Dollar','forex',1.6620,0.00,true,0.01,400,0.00015,100000,'EUR','AUD','forex.em/EURAUD'),
    ('EURNZD','Euro / New Zealand Dollar','forex',1.8370,0.00,true,0.01,400,0.00018,100000,'EUR','NZD','forex.em/EURNZD'),
    ('EURCHF','Euro / Swiss Franc','forex',0.9480,0.00,true,0.01,400,0.00010,100000,'EUR','CHF','forex.em/EURCHF'),
    ('AUDJPY','Australian Dollar / Japanese Yen','forex',97.90,0.00,true,0.01,400,0.01000,100000,'AUD','JPY','forex.em/AUDJPY'),
    ('AUDNZD','Australian Dollar / New Zealand Dollar','forex',1.1060,0.00,true,0.01,400,0.00012,100000,'AUD','NZD','forex.em/AUDNZD'),
    ('NZDJPY','New Zealand Dollar / Japanese Yen','forex',88.60,0.00,true,0.01,400,0.01000,100000,'NZD','JPY','forex.em/NZDJPY'),
    ('GBPAUD','British Pound / Australian Dollar','forex',1.9340,0.00,true,0.01,400,0.00018,100000,'GBP','AUD','forex.em/GBPAUD'),
    ('GBPCAD','British Pound / Canadian Dollar','forex',1.7280,0.00,true,0.01,400,0.00018,100000,'GBP','CAD','forex.em/GBPCAD'),
    ('USDMXN','US Dollar / Mexican Peso','forex',18.50,0.00,true,0.01,200,0.01000,100000,'USD','MXN','forex.em/USDMXN'),
    ('USDZAR','US Dollar / South African Rand','forex',18.00,0.00,true,0.01,200,0.02000,100000,'USD','ZAR','forex.em/USDZAR'),
    
    -- Commodities (6) - category: 'commodities'
    ('XAUUSD','Gold','commodities',2350.00,0.00,true,0.01,100,0.50,1,null,null,'metal.em/XAUUSD'),
    ('XAGUSD','Silver','commodities',28.00,0.00,true,0.01,100,0.05,1,null,null,'metal.em/XAGUSD'),
    ('XPTUSD','Platinum','commodities',950.00,0.00,true,0.01,100,2.00,1,null,null,'metal.em/XPTUSD'),
    ('USOIL','WTI Crude Oil','commodities',80.00,0.00,true,0.01,100,0.05,1,null,null,'energy.em/CL'),
    ('UKOIL','Brent Crude Oil','commodities',84.00,0.00,true,0.01,100,0.05,1,null,null,'energy.em/BZ'),
    ('NATGAS','Natural Gas','commodities',3.00,0.00,true,0.01,100,0.02,1,null,null,'energy.em/NG'),
    
    -- Indices (8) - category: 'indices'
    ('US500','S&P 500','indices',5600.00,0.00,true,0.01,100,0.50,1,null,null,'index.usa/SPX'),
    ('US100','NASDAQ 100','indices',20000.00,0.00,true,0.01,100,1.00,1,null,null,'index.usa/NDX'),
    ('US30','Dow Jones 30','indices',40000.00,0.00,true,0.01,100,2.00,1,null,null,'index.usa/DJI'),
    ('GER40','Germany 40 (DAX)','indices',18500.00,0.00,true,0.01,100,1.50,1,null,null,'index.eur/DAX'),
    ('UK100','UK 100 (FTSE)','indices',8500.00,0.00,true,0.01,100,1.20,1,null,null,'index.eur/FTSE'),
    ('JPN225','Japan 225 (Nikkei)','indices',42000.00,0.00,true,0.01,100,4.00,1,null,null,'index.asia/N225'),
    ('FRA40','France 40 (CAC)','indices',8200.00,0.00,true,0.01,100,1.20,1,null,null,'index.eur/CAC'),
    ('AUS200','Australia 200 (ASX)','indices',7800.00,0.00,true,0.01,100,1.50,1,null,null,'index.asia/ASX'),
    
    -- Stocks (13) - category: 'stocks'
    ('AAPL','Apple Inc.','stocks',225.00,0.00,true,0.01,20,0.01,1,null,null,'stock.us.nasdaq/AAPL'),
    ('MSFT','Microsoft Corporation','stocks',420.00,0.00,true,0.01,20,0.02,1,null,null,'stock.us.nasdaq/MSFT'),
    ('GOOGL','Alphabet Inc.','stocks',175.00,0.00,true,0.01,20,0.05,1,null,null,'stock.us.nasdaq/GOOGL'),
    ('AMZN','Amazon.com Inc.','stocks',185.00,0.00,true,0.01,20,0.03,1,null,null,'stock.us.nasdaq/AMZN'),
    ('NVDA','NVIDIA Corporation','stocks',1100.00,0.00,true,0.01,20,0.20,1,null,null,'stock.us.nasdaq/NVDA'),
    ('TSLA','Tesla Inc.','stocks',250.00,0.00,true,0.01,20,0.10,1,null,null,'stock.us.nasdaq/TSLA'),
    ('META','Meta Platforms Inc.','stocks',520.00,0.00,true,0.01,20,0.05,1,null,null,'stock.us.nasdaq/META'),
    ('NFLX','Netflix Inc.','stocks',650.00,0.00,true,0.01,20,0.10,1,null,null,'stock.us.nasdaq/NFLX'),
    ('JPM','JPMorgan Chase & Co.','stocks',205.00,0.00,true,0.01,20,0.03,1,null,null,'stock.us.nyse/JPM'),
    ('V','Visa Inc.','stocks',280.00,0.00,true,0.01,20,0.03,1,null,null,'stock.us.nyse/V'),
    ('JNJ','Johnson & Johnson','stocks',165.00,0.00,true,0.01,20,0.03,1,null,null,'stock.us.nyse/JNJ'),
    ('WMT','Walmart Inc.','stocks',75.00,0.00,true,0.01,20,0.02,1,null,null,'stock.us.nyse/WMT'),
    ('PG','Procter & Gamble','stocks',170.00,0.00,true,0.01,20,0.03,1,null,null,'stock.us.nyse/PG')
  ) AS t(symbol,name,category,price,change_24h,is_active,min_trade_size,max_leverage,spread,contract_size,base_currency,quote_currency,alltick_code)
)
INSERT INTO assets (
  symbol, name, category, price, change_24h, is_active, min_trade_size, 
  max_leverage, spread, contract_size, base_currency, quote_currency, alltick_code
)
SELECT 
  symbol, name, category, price, change_24h, is_active, min_trade_size,
  max_leverage, spread, contract_size, base_currency, quote_currency, alltick_code
FROM new_assets
ON CONFLICT (symbol) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  is_active = true,
  min_trade_size = EXCLUDED.min_trade_size,
  max_leverage = EXCLUDED.max_leverage,
  spread = EXCLUDED.spread,
  contract_size = EXCLUDED.contract_size,
  base_currency = EXCLUDED.base_currency,
  quote_currency = EXCLUDED.quote_currency,
  alltick_code = EXCLUDED.alltick_code,
  updated_at = now();