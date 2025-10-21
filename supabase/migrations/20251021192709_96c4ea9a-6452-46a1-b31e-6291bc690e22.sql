-- CLEANUP: Remove duplicate triggers and ensure correct function versions
-- This migration fixes balance corruption issues caused by:
-- 1. Multiple triggers firing for the same trade action (race conditions)
-- 2. Old function versions with hardcoded base_balance = 10000

-- ============================================================================
-- PHASE 1: Remove Duplicate Triggers
-- ============================================================================

-- Drop all duplicate/conflicting triggers on trades table
DROP TRIGGER IF EXISTS trigger_trade_opened ON public.trades;
DROP TRIGGER IF EXISTS trigger_trade_closed ON public.trades;
DROP TRIGGER IF EXISTS enhanced_trade_open_trigger ON public.trades;
DROP TRIGGER IF EXISTS enhanced_trade_close_trigger ON public.trades;

-- Drop the enhanced trigger functions (no longer needed, duplicates core logic)
DROP FUNCTION IF EXISTS public.update_user_balance_on_trade_open_enhanced();
DROP FUNCTION IF EXISTS public.update_user_balance_on_trade_close_enhanced();

-- Keep only the canonical triggers (these remain active):
-- - tr_handle_trade_opened (handles INSERT)
-- - tr_handle_trade_closed (handles UPDATE from open to closed)

-- ============================================================================
-- PHASE 2: Ensure Correct Function Version
-- ============================================================================

-- Drop old versions of auto_recalculate_user_margins to prevent conflicts
DROP FUNCTION IF EXISTS public.auto_recalculate_user_margins(uuid);

-- Recreate the CORRECT version that preserves existing balance
-- This version does NOT reset balance to 10000, it preserves current balance
CREATE OR REPLACE FUNCTION public.auto_recalculate_user_margins(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_used_margin DECIMAL := 0;
  current_balance DECIMAL;
  liquidation_result json;
  trade_count INTEGER;
BEGIN
  RAISE NOTICE 'Starting margin recalculation for user: %', _user_id;
  
  -- Get CURRENT balance (preserves admin deposits and all previous P&L!)
  SELECT balance INTO current_balance
  FROM user_profiles
  WHERE user_id = _user_id;
  
  IF current_balance IS NULL THEN
    current_balance := 0;
  END IF;
  
  RAISE NOTICE 'Current balance: %', current_balance;
  
  -- Calculate total margin used by open trades
  SELECT COALESCE(SUM(margin_used), 0), COUNT(*) 
  INTO total_used_margin, trade_count
  FROM trades
  WHERE user_id = _user_id AND status = 'open';
  
  RAISE NOTICE 'Open trades: count=%, total_used_margin=%', trade_count, total_used_margin;
  
  -- Update ONLY margins, preserve balance (critical: do NOT reset balance!)
  UPDATE user_profiles
  SET 
    used_margin = total_used_margin,
    available_margin = GREATEST(current_balance - total_used_margin, 0),
    equity = current_balance, -- Frontend adds unrealized P&L
    updated_at = now()
  WHERE user_id = _user_id;
  
  RAISE NOTICE 'Updated margins - balance preserved: %, used_margin: %, available_margin: %', 
    current_balance, total_used_margin, GREATEST(current_balance - total_used_margin, 0);
  
  -- After updating margins, check if liquidation is needed
  SELECT check_and_liquidate_positions(_user_id) INTO liquidation_result;
  
  IF (liquidation_result->>'stop_out_triggered')::boolean THEN
    RAISE NOTICE 'Stop-out executed: %', liquidation_result;
  END IF;
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- After this migration:
-- ✅ Only 2 triggers remain on trades table (tr_handle_trade_opened, tr_handle_trade_closed)
-- ✅ auto_recalculate_user_margins preserves existing balance
-- ✅ No duplicate trigger executions
-- ✅ Balance only changes via:
--    - close_trade_with_pnl (adds P&L to existing balance)
--    - admin_modify_user_balance (manual admin adjustment)
--    - Deposit/withdrawal approval

-- The correct flow is now:
-- 1. Trade opens → tr_handle_trade_opened → auto_recalculate_user_margins (reserves margin, balance unchanged)
-- 2. Trade closes → close_trade_with_pnl (adds P&L to EXISTING balance) → tr_handle_trade_closed → auto_recalculate_user_margins (releases margin, balance already updated by RPC)