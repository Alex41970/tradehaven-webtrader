-- Reset user profile data to clean state (assuming single user for demo)
UPDATE public.user_profiles 
SET 
  balance = 10000.00,
  equity = 10000.00,
  used_margin = 0.00,
  available_margin = 10000.00
WHERE TRUE;