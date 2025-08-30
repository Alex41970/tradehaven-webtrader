-- Enable real-time for user_bot_status table
ALTER TABLE public.user_bot_status REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_bot_status;