-- Fix available margin calculation issue and add validation

-- First, run recalculate_user_balance for all users to fix stale data
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT user_id FROM public.user_profiles LOOP
        PERFORM public.recalculate_user_balance(user_record.user_id);
    END LOOP;
END $$;

-- Add a validation trigger to ensure available_margin = balance - used_margin
CREATE OR REPLACE FUNCTION public.validate_user_balance()
RETURNS TRIGGER AS $function$
BEGIN
  -- Ensure available_margin equals balance minus used_margin
  NEW.available_margin = NEW.balance - NEW.used_margin;
  
  -- Ensure available_margin is never negative
  NEW.available_margin = GREATEST(NEW.available_margin, 0);
  
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql;

-- Create trigger to validate balance calculations on insert/update
DROP TRIGGER IF EXISTS trigger_validate_user_balance ON public.user_profiles;
CREATE TRIGGER trigger_validate_user_balance
    BEFORE INSERT OR UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_user_balance();