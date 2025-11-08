-- Add 'admin_adjustment' to allowed deposit and withdrawal types
-- This fixes the constraint violation when admins modify user balances

-- Drop and recreate deposit_type constraint
ALTER TABLE public.deposit_requests
  DROP CONSTRAINT IF EXISTS deposit_requests_deposit_type_check;

ALTER TABLE public.deposit_requests
  ADD CONSTRAINT deposit_requests_deposit_type_check
  CHECK (deposit_type IN ('crypto', 'wire', 'admin_adjustment'));

-- Drop and recreate withdrawal_type constraint  
ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_withdrawal_type_check;

ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_withdrawal_type_check
  CHECK (withdrawal_type IN ('crypto', 'wire', 'admin_adjustment'));