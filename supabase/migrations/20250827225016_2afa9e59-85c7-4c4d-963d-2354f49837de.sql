-- Check if triggers are properly attached and fix any issues

-- Drop existing triggers to recreate them properly
DROP TRIGGER IF EXISTS update_user_balance_on_trade_open_trigger ON public.trades;
DROP TRIGGER IF EXISTS update_user_balance_on_trade_close_trigger ON public.trades;
DROP TRIGGER IF EXISTS validate_user_balance_trigger ON public.user_profiles;

-- Recreate triggers with proper attachment
CREATE TRIGGER update_user_balance_on_trade_open_trigger
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_open();

CREATE TRIGGER update_user_balance_on_trade_close_trigger
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_close();

CREATE TRIGGER validate_user_balance_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_balance();

-- Add updated_at triggers for consistency
CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();