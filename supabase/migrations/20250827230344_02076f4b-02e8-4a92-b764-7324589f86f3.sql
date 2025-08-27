-- Fix the triple margin calculation issue with comprehensive trigger cleanup

-- Step 1: Drop ALL possible trigger variations to ensure clean slate
DROP TRIGGER IF EXISTS update_user_balance_on_trade_open_trigger ON public.trades;
DROP TRIGGER IF EXISTS update_user_balance_on_trade_close_trigger ON public.trades;
DROP TRIGGER IF EXISTS update_trades_updated_at ON public.trades;
DROP TRIGGER IF EXISTS trades_update_balance_open ON public.trades;
DROP TRIGGER IF EXISTS trades_update_balance_close ON public.trades;
DROP TRIGGER IF EXISTS update_balance_on_trade_open ON public.trades;
DROP TRIGGER IF EXISTS update_balance_on_trade_close ON public.trades;

-- Step 2: Drop any duplicate triggers on user_profiles
DROP TRIGGER IF EXISTS validate_user_balance_trigger ON public.user_profiles;
DROP TRIGGER IF EXISTS validate_balance_trigger ON public.user_profiles;

-- Step 3: Create ONLY ONE set of triggers with unique names
CREATE TRIGGER trades_balance_open_trigger
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_open();

CREATE TRIGGER trades_balance_close_trigger
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_close();

CREATE TRIGGER trades_timestamp_trigger
  BEFORE UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER profiles_balance_validation_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_balance();

-- Step 4: Reset all user balances to fix corruption
DO $$
DECLARE
  user_record RECORD;
BEGIN
  -- First set all balances to base values to clear corruption
  UPDATE public.user_profiles SET 
    balance = 10000.00,
    used_margin = 0.00,
    available_margin = 10000.00,
    equity = 10000.00;
    
  -- Then recalculate based on actual trades  
  FOR user_record IN SELECT DISTINCT user_id FROM public.user_profiles LOOP
    PERFORM public.recalculate_user_balance(user_record.user_id);
  END LOOP;
  
  RAISE NOTICE 'Successfully reset and recalculated all user balances';
END $$;