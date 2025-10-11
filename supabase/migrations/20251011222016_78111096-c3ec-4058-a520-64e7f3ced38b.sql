-- Phase 1: Remove duplicate price update cron job
SELECT cron.unschedule('update-asset-prices');

-- Phase 3: Optimize order monitor interval (5s -> 15s)
SELECT cron.unschedule('order-monitor-5sec');

SELECT cron.schedule(
  'order-monitor-15sec',
  '*/15 * * * * *',
  $$
  SELECT net.http_post(
    url:='https://stdfkfutgkmnaajixguz.supabase.co/functions/v1/order-monitor',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZGZrZnV0Z2ttbmFhaml4Z3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTI3NjUsImV4cCI6MjA3MTg4ODc2NX0.kf5keye0-ezD9cjcvTWxMsBbpVELf_cWIwL2OeW0Yg4"}'::jsonb,
    body:=concat('{"timestamp": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

-- Phase 3: Drop unused/redundant database functions
DROP FUNCTION IF EXISTS public.recalculate_user_balance(uuid);
DROP FUNCTION IF EXISTS public.validate_user_margins(uuid);
DROP FUNCTION IF EXISTS public.validate_margin_consistency();
DROP FUNCTION IF EXISTS public.recalculate_all_user_margins();