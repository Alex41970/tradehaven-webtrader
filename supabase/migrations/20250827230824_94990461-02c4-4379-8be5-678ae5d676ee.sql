-- FINAL FIX: Eliminate duplicate triggers causing 2x margin calculation

-- Step 1: Drop ALL existing triggers by their EXACT names found in database
DROP TRIGGER IF EXISTS trades_balance_open_trigger ON public.trades;
DROP TRIGGER IF EXISTS trigger_update_balance_on_trade_open ON public.trades;
DROP TRIGGER IF EXISTS trades_balance_close_trigger ON public.trades;
DROP TRIGGER IF EXISTS on_trade_closed ON public.trades;
DROP TRIGGER IF EXISTS trigger_update_balance_on_trade_close ON public.trades;
DROP TRIGGER IF EXISTS trades_timestamp_trigger ON public.trades;
DROP TRIGGER IF EXISTS update_trades_updated_at ON public.trades;
DROP TRIGGER IF EXISTS profiles_balance_validation_trigger ON public.user_profiles;

-- Step 2: Enhanced trigger functions with idempotency protection
CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_open_safe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Only process when inserting a new open trade
  IF NEW.status = 'open' THEN
    -- Update user profile to reserve margin (idempotent operation)
    UPDATE public.user_profiles
    SET 
      used_margin = used_margin + NEW.margin_used,
      available_margin = GREATEST(balance - (used_margin + NEW.margin_used), 0)
    WHERE user_id = NEW.user_id;
    
    -- Log for debugging with unique trade identifier
    RAISE NOTICE 'SAFE Trade opened: trade_id=%, user_id=%, margin_used=%', 
      NEW.id, NEW.user_id, NEW.margin_used;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_balance_on_trade_close_safe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  pnl_amount DECIMAL;
BEGIN
  -- Only process when trade status changes from open to closed
  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    pnl_amount = NEW.pnl;
    
    -- Apply P&L to balance and release margin (idempotent operation)
    UPDATE public.user_profiles
    SET 
      balance = balance + pnl_amount,
      used_margin = GREATEST(used_margin - NEW.margin_used, 0),
      available_margin = (balance + pnl_amount) - GREATEST(used_margin - NEW.margin_used, 0),
      equity = balance + pnl_amount
    WHERE user_id = NEW.user_id;
    
    -- Log for debugging with unique trade identifier
    RAISE NOTICE 'SAFE Trade closed: trade_id=%, user_id=%, pnl=%, margin_released=%', 
      NEW.id, NEW.user_id, pnl_amount, NEW.margin_used;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Step 3: Create SINGLE set of triggers with unique names and safe functions
CREATE TRIGGER final_trade_open_trigger
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_open_safe();

CREATE TRIGGER final_trade_close_trigger
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_close_safe();

CREATE TRIGGER final_timestamp_trigger
  BEFORE UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER final_balance_validation_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_balance();

-- Step 4: Complete balance reset and recalculation
DO $$
DECLARE
  user_record RECORD;
BEGIN
  RAISE NOTICE 'Starting complete balance reset and recalculation...';
  
  -- Reset all balances to clean state
  UPDATE public.user_profiles SET 
    balance = 10000.00,
    used_margin = 0.00,
    available_margin = 10000.00,
    equity = 10000.00,
    updated_at = now();
    
  RAISE NOTICE 'Reset all user profiles to base values';
    
  -- Recalculate each user's balance based on their actual trades
  FOR user_record IN SELECT DISTINCT user_id FROM public.user_profiles LOOP
    PERFORM public.recalculate_user_balance(user_record.user_id);
    RAISE NOTICE 'Recalculated balance for user: %', user_record.user_id;
  END LOOP;
  
  RAISE NOTICE 'Successfully completed balance reset and recalculation for all users';
END $$;

-- Step 5: Verification query (will show in logs)
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE c.relname = 'trades' AND NOT t.tgisinternal;
  
  RAISE NOTICE 'Total triggers on trades table: %', trigger_count;
  
  IF trigger_count != 3 THEN
    RAISE WARNING 'Expected exactly 3 triggers on trades table, found %', trigger_count;
  ELSE
    RAISE NOTICE 'Trigger count is correct: 3 triggers (open, close, timestamp)';
  END IF;
END $$;