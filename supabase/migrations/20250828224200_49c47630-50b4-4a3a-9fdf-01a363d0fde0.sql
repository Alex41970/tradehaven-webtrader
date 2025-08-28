-- Add trade_source column to trades table to distinguish bot vs user trades
ALTER TABLE public.trades 
ADD COLUMN trade_source TEXT NOT NULL DEFAULT 'user';

-- Add check constraint for valid trade sources
ALTER TABLE public.trades 
ADD CONSTRAINT trades_trade_source_check 
CHECK (trade_source IN ('bot', 'user'));

-- Update existing admin_create_trade function to mark trades as bot trades
CREATE OR REPLACE FUNCTION public.admin_create_trade(
  _admin_id UUID,
  _user_id UUID,
  _asset_id UUID,
  _symbol TEXT,
  _trade_type TEXT,
  _amount NUMERIC,
  _leverage INTEGER,
  _open_price NUMERIC
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_profile RECORD;
  _asset_record RECORD;
  _margin_required NUMERIC;
  _trade_id UUID;
BEGIN
  -- Verify admin has access to this user
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_user_relationships
    WHERE admin_id = _admin_id AND user_id = _user_id
  ) AND NOT public.has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied to this user');
  END IF;
  
  -- Get user profile
  SELECT balance, used_margin, available_margin
  INTO _user_profile
  FROM public.user_profiles
  WHERE user_id = _user_id;
  
  IF _user_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  -- Get asset details
  SELECT min_trade_size, max_leverage, is_active
  INTO _asset_record
  FROM public.assets
  WHERE id = _asset_id;
  
  IF _asset_record IS NULL OR NOT _asset_record.is_active THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or inactive asset');
  END IF;
  
  -- Validate trade parameters
  IF _amount < _asset_record.min_trade_size THEN
    RETURN json_build_object('success', false, 'error', 'Amount below minimum trade size');
  END IF;
  
  IF _leverage > _asset_record.max_leverage THEN
    RETURN json_build_object('success', false, 'error', 'Leverage exceeds maximum allowed');
  END IF;
  
  IF _trade_type NOT IN ('BUY', 'SELL') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid trade type');
  END IF;
  
  -- Calculate margin required
  _margin_required = _amount * _open_price / _leverage;
  
  -- Check if user has sufficient margin
  IF _user_profile.available_margin < _margin_required THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient margin available');
  END IF;
  
  -- Create the trade (marked as bot trade)
  INSERT INTO public.trades (
    user_id,
    asset_id,
    symbol,
    trade_type,
    amount,
    leverage,
    open_price,
    current_price,
    margin_used,
    status,
    trade_source
  ) VALUES (
    _user_id,
    _asset_id,
    _symbol,
    _trade_type,
    _amount,
    _leverage,
    _open_price,
    _open_price,
    _margin_required,
    'open',
    'bot'
  ) RETURNING id INTO _trade_id;
  
  -- Update user margin (this will be handled by the trigger, but we return the expected state)
  RETURN json_build_object(
    'success', true, 
    'trade_id', _trade_id,
    'margin_used', _margin_required,
    'message', 'Bot trade created successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;