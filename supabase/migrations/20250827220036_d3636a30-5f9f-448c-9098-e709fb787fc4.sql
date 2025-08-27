-- Recalculate balances for all existing users to fix any inconsistent data
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT DISTINCT user_id FROM public.user_profiles
    LOOP
        PERFORM public.recalculate_user_balance(user_record.user_id);
    END LOOP;
END $$;