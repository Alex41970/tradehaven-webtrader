-- Enhanced fetchBotStatus to validate license is still active
CREATE OR REPLACE FUNCTION public.get_valid_bot_status(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _bot_status RECORD;
  _license RECORD;
BEGIN
  -- Get user's bot status
  SELECT * INTO _bot_status
  FROM user_bot_status
  WHERE user_id = _user_id;
  
  -- If no bot status found, return null
  IF _bot_status IS NULL THEN
    RETURN json_build_object('valid', false, 'reason', 'no_bot_status');
  END IF;
  
  -- Check if associated license is still active
  SELECT * INTO _license
  FROM bot_licenses
  WHERE license_key = _bot_status.license_key
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > now());
  
  -- If license is not active or expired, clean up bot status
  IF _license IS NULL THEN
    -- Remove invalid bot status
    DELETE FROM user_bot_status WHERE user_id = _user_id;
    
    -- Free up the license if it exists but is inactive
    UPDATE bot_licenses 
    SET used_by_user_id = NULL 
    WHERE license_key = _bot_status.license_key AND used_by_user_id = _user_id;
    
    RETURN json_build_object('valid', false, 'reason', 'invalid_license');
  END IF;
  
  -- Return valid bot status
  RETURN json_build_object(
    'valid', true,
    'bot_status', row_to_json(_bot_status),
    'license', row_to_json(_license)
  );
END;
$function$;