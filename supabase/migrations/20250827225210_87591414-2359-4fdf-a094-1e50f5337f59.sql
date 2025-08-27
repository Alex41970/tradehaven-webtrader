-- Fix triggers - only create what doesn't exist
DO $$
BEGIN
  -- Create trade open trigger if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_balance_on_trade_open_trigger') THEN
    CREATE TRIGGER update_user_balance_on_trade_open_trigger
      AFTER INSERT ON public.trades
      FOR EACH ROW
      EXECUTE FUNCTION public.update_user_balance_on_trade_open();
  END IF;

  -- Create trade close trigger if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_balance_on_trade_close_trigger') THEN
    CREATE TRIGGER update_user_balance_on_trade_close_trigger
      AFTER UPDATE ON public.trades
      FOR EACH ROW
      EXECUTE FUNCTION public.update_user_balance_on_trade_close();
  END IF;

  -- Create balance validation trigger if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_user_balance_trigger') THEN
    CREATE TRIGGER validate_user_balance_trigger
      BEFORE UPDATE ON public.user_profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_user_balance();
  END IF;
END $$;