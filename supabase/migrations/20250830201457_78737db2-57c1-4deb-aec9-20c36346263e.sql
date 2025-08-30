-- Enhanced license deactivation function that disconnects users
CREATE OR REPLACE FUNCTION public.deactivate_and_disconnect_license(_admin_id uuid, _license_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _license RECORD;
  _affected_users TEXT[] := ARRAY[]::TEXT[];
  _user_email TEXT;
BEGIN
  -- Get license details
  SELECT * INTO _license
  FROM bot_licenses
  WHERE id = _license_id AND admin_id = _admin_id;
  
  IF _license IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'License not found or access denied');
  END IF;
  
  -- If license is in use, collect user info and disconnect
  IF _license.used_by_user_id IS NOT NULL THEN
    -- Get user email for notification
    SELECT email INTO _user_email
    FROM user_profiles
    WHERE user_id = _license.used_by_user_id;
    
    IF _user_email IS NOT NULL THEN
      _affected_users := array_append(_affected_users, _user_email);
    END IF;
    
    -- Remove user's bot status (disconnect them)
    DELETE FROM user_bot_status
    WHERE user_id = _license.used_by_user_id AND license_key = _license.license_key;
    
    -- Free up the license
    UPDATE bot_licenses
    SET used_by_user_id = NULL, updated_at = now()
    WHERE id = _license_id;
  END IF;
  
  -- Deactivate the license
  UPDATE bot_licenses
  SET is_active = false, updated_at = now()
  WHERE id = _license_id;
  
  RETURN json_build_object(
    'success', true,
    'affected_users', _affected_users,
    'message', CASE 
      WHEN array_length(_affected_users, 1) > 0 
      THEN format('License deactivated and %s user(s) disconnected', array_length(_affected_users, 1))
      ELSE 'License deactivated'
    END
  );
END;
$function$;