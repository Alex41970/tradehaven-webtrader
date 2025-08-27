-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the price update function to run every 30 seconds
SELECT cron.schedule(
  'update-asset-prices',
  '*/30 * * * * *', -- Every 30 seconds
  $$
  SELECT
    net.http_post(
        url:='https://stdfkfutgkmnaajixguz.supabase.co/functions/v1/update-prices',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZGZrZnV0Z2ttbmFhaml4Z3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTI3NjUsImV4cCI6MjA3MTg4ODc2NX0.kf5keye0-ezD9cjcvTWxMsBbpVELf_cWIwL2OeW0Yg4"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);