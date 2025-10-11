-- Enable cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing price update cron jobs
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname LIKE 'update-prices%';

-- Schedule AllTick REST API price updates every 60 seconds
-- This gives us room for ~40 assets (1.5s each) per cycle without hitting rate limits
SELECT cron.schedule(
  'update-prices-from-alltick',
  '*/60 * * * * *', -- Every 60 seconds
  $$
  SELECT net.http_post(
    url:='https://stdfkfutgkmnaajixguz.supabase.co/functions/v1/update-prices',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZGZrZnV0Z2ttbmFhaml4Z3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTI3NjUsImV4cCI6MjA3MTg4ODc2NX0.kf5keye0-ezD9cjcvTWxMsBbpVELf_cWIwL2OeW0Yg4"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);