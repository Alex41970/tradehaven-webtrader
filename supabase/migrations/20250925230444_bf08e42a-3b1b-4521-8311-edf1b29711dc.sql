-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create database indexes for efficient SL/TP monitoring
CREATE INDEX IF NOT EXISTS idx_trades_sl_tp_monitoring 
  ON trades(status, stop_loss_price, take_profit_price, user_id) 
  WHERE status = 'open' AND (stop_loss_price IS NOT NULL OR take_profit_price IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_trade_orders_pending_monitoring 
  ON trade_orders(status, expires_at) 
  WHERE status = 'pending' AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_user_status 
  ON trades(user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_profiles_margins 
  ON user_profiles(user_id, available_margin, used_margin);

-- Schedule order monitor to run every 5 seconds
SELECT cron.schedule(
  'order-monitor-5sec',
  '*/5 * * * * *', -- Every 5 seconds
  $$
  SELECT
    net.http_post(
        url:='https://stdfkfutgkmnaajixguz.supabase.co/functions/v1/order-monitor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZGZrZnV0Z2ttbmFhaml4Z3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTI3NjUsImV4cCI6MjA3MTg4ODc2NX0.kf5keye0-ezD9cjcvTWxMsBbpVELf_cWIwL2OeW0Yg4"}'::jsonb,
        body:=concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);