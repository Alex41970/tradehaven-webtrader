-- Fix the triple margin calculation issue by cleaning up triggers and recalculating balances

-- Step 1: Drop all existing triggers on trades table to prevent duplicates
DROP TRIGGER IF EXISTS update_user_balance_on_trade_open_trigger ON public.trades;
DROP TRIGGER IF EXISTS update_user_balance_on_trade_close_trigger ON public.trades;  
DROP TRIGGER IF EXISTS update_trades_updated_at ON public.trades;

-- Step 2: Recreate the trade balance triggers with proper safeguards
CREATE TRIGGER update_user_balance_on_trade_open_trigger
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_open();

CREATE TRIGGER update_user_balance_on_trade_close_trigger
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_close();

-- Step 3: Recreate the updated_at trigger
CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Step 4: Clean up user balance validation trigger and recreate it
DROP TRIGGER IF EXISTS validate_user_balance_trigger ON public.user_profiles;
CREATE TRIGGER validate_user_balance_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_balance();

-- Step 5: Recalculate all user balances to fix any corrupted data
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT DISTINCT user_id FROM public.user_profiles LOOP
    PERFORM public.recalculate_user_balance(user_record.user_id);
  END LOOP;
END $$;