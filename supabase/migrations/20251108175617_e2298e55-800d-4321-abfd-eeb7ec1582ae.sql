-- Function to validate promo code BEFORE signup (read-only check)
create or replace function public.validate_promo_code_for_signup(_promo_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code record;
begin
  -- Validate input
  if _promo_code is null or trim(_promo_code) = '' then
    return jsonb_build_object(
      'valid', false,
      'error', 'Promo code cannot be empty'
    );
  end if;
  
  -- Find the promo code
  select * into v_code
  from promo_codes
  where code = trim(_promo_code);
  
  -- Check if code exists
  if not found then
    return jsonb_build_object(
      'valid', false,
      'error', 'Invalid promo code'
    );
  end if;
  
  -- Check if code is active
  if not v_code.is_active then
    return jsonb_build_object(
      'valid', false,
      'error', 'Promo code is inactive'
    );
  end if;
  
  -- Check if code has expired
  if v_code.expires_at is not null and v_code.expires_at < now() then
    return jsonb_build_object(
      'valid', false,
      'error', 'Promo code has expired'
    );
  end if;
  
  -- Check if code has reached max uses
  if v_code.max_uses is not null and v_code.current_uses >= v_code.max_uses then
    return jsonb_build_object(
      'valid', false,
      'error', 'Promo code usage limit reached'
    );
  end if;
  
  -- Verify admin still exists and has admin role
  if not exists (
    select 1 from user_roles 
    where user_id = v_code.admin_id and role = 'admin'
  ) then
    return jsonb_build_object(
      'valid', false,
      'error', 'Associated admin no longer exists'
    );
  end if;
  
  -- All checks passed
  return jsonb_build_object(
    'valid', true,
    'admin_id', v_code.admin_id,
    'code_id', v_code.id,
    'admin_name', (select email from user_profiles where user_id = v_code.admin_id)
  );
end;
$$;

-- Grant execute permission to anonymous and authenticated users
grant execute on function public.validate_promo_code_for_signup(text) to anon, authenticated;