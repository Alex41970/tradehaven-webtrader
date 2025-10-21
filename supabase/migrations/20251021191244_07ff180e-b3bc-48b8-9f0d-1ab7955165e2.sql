-- Remove the rogue trigger and function that resets balance to 10000
-- This trigger was interfering with the correct balance updates from close_trade_with_pnl

-- Drop the problematic triggers
DROP TRIGGER IF EXISTS trigger_trade_margin_insert ON public.trades;
DROP TRIGGER IF EXISTS trigger_trade_margin_update ON public.trades;
DROP TRIGGER IF EXISTS on_trade_closed ON public.trades;

-- Drop the function that was resetting balance to base_balance = 10000
DROP FUNCTION IF EXISTS public.handle_trade_margin_update();

-- The correct flow is now:
-- 1. admin_close_trade (or close_trade_with_pnl) updates the trade and adds PnL to EXISTING balance
-- 2. tr_handle_trade_closed trigger runs auto_recalculate_user_margins to adjust margins WITHOUT resetting balance
-- This ensures balance is only modified by actual trade P&L, not reset to arbitrary values