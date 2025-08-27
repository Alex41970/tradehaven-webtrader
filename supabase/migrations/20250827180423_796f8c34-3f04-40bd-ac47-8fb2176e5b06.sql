-- Fix security warnings by setting search_path on functions
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.calculate_pnl(TEXT, DECIMAL, DECIMAL, DECIMAL) SET search_path = '';
ALTER FUNCTION public.update_user_balance_on_trade_close() SET search_path = '';