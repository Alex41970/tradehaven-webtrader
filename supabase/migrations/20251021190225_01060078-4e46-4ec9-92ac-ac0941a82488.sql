-- Drop the old admin_close_trade function that returns boolean
DROP FUNCTION IF EXISTS public.admin_close_trade(uuid, uuid, numeric);

-- Create new admin_close_trade that uses close_trade_with_pnl RPC for consistency
-- This ensures all trade closing paths use the same logic to prevent balance corruption
CREATE OR REPLACE FUNCTION public.admin_close_trade(_admin_id uuid, _trade_id uuid, _close_price numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _trade_record RECORD;
  _close_result jsonb;
BEGIN
  -- Get trade details for permission check
  SELECT user_id, status
  INTO _trade_record
  FROM trades
  WHERE id = _trade_id;
  
  -- Check if trade exists and is open
  IF _trade_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;
  
  IF _trade_record.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade is already closed');
  END IF;
  
  -- Verify admin has access to this user's trades
  IF NOT EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _trade_record.user_id
  ) AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied to this user');
  END IF;
  
  -- Use the battle-tested close_trade_with_pnl RPC (single source of truth!)
  SELECT close_trade_with_pnl(_trade_id, _close_price) INTO _close_result;
  
  -- Check if RPC returned an error
  IF (_close_result->>'error') IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', _close_result->>'error');
  END IF;
  
  -- Trigger margin recalculation
  PERFORM auto_recalculate_user_margins(_trade_record.user_id);
  
  -- Return success with details
  RETURN jsonb_build_object(
    'success', true,
    'pnl', (_close_result->>'pnl')::numeric,
    'new_balance', (_close_result->>'new_balance')::numeric,
    'close_price', (_close_result->>'close_price')::numeric,
    'message', 'Trade closed successfully by admin'
  );
END;
$$;

COMMENT ON FUNCTION public.admin_close_trade(uuid, uuid, numeric) IS 
'Admin trade closure - delegates to close_trade_with_pnl for consistency across all trade closing mechanisms';