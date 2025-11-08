-- Create table to track promo code validation attempts
create table public.promo_validation_attempts (
  id uuid primary key default gen_random_uuid(),
  promo_code text not null,
  attempted_at timestamp with time zone not null default now(),
  was_valid boolean not null,
  error_reason text,
  ip_address inet,
  user_agent text,
  resulted_in_signup boolean default false,
  created_user_id uuid
);

-- Enable RLS
alter table public.promo_validation_attempts enable row level security;

-- Admins can view validation attempts
create policy "Admins can view validation attempts"
on public.promo_validation_attempts
for select
using (
  has_role(auth.uid(), 'admin'::app_role) or 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- System can insert validation attempts
create policy "System can insert validation attempts"
on public.promo_validation_attempts
for insert
with check (true);

-- Create index for performance
create index idx_promo_validation_attempts_code on public.promo_validation_attempts(promo_code);
create index idx_promo_validation_attempts_date on public.promo_validation_attempts(attempted_at desc);

-- Update the validate_promo_code_for_signup function to log attempts
create or replace function public.validate_promo_code_for_signup(_promo_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code record;
  v_result jsonb;
  v_error_reason text;
begin
  -- Validate input
  if _promo_code is null or trim(_promo_code) = '' then
    v_error_reason := 'Promo code cannot be empty';
    v_result := jsonb_build_object(
      'valid', false,
      'error', v_error_reason
    );
    
    -- Log attempt
    insert into promo_validation_attempts (promo_code, was_valid, error_reason)
    values (coalesce(trim(_promo_code), 'EMPTY'), false, v_error_reason);
    
    return v_result;
  end if;
  
  -- Find the promo code
  select * into v_code
  from promo_codes
  where code = trim(_promo_code);
  
  -- Check if code exists
  if not found then
    v_error_reason := 'Invalid promo code';
    v_result := jsonb_build_object(
      'valid', false,
      'error', v_error_reason
    );
    
    -- Log attempt
    insert into promo_validation_attempts (promo_code, was_valid, error_reason)
    values (trim(_promo_code), false, v_error_reason);
    
    return v_result;
  end if;
  
  -- Check if code is active
  if not v_code.is_active then
    v_error_reason := 'Promo code is inactive';
    v_result := jsonb_build_object(
      'valid', false,
      'error', v_error_reason
    );
    
    -- Log attempt
    insert into promo_validation_attempts (promo_code, was_valid, error_reason)
    values (trim(_promo_code), false, v_error_reason);
    
    return v_result;
  end if;
  
  -- Check if code has expired
  if v_code.expires_at is not null and v_code.expires_at < now() then
    v_error_reason := 'Promo code has expired';
    v_result := jsonb_build_object(
      'valid', false,
      'error', v_error_reason
    );
    
    -- Log attempt
    insert into promo_validation_attempts (promo_code, was_valid, error_reason)
    values (trim(_promo_code), false, v_error_reason);
    
    return v_result;
  end if;
  
  -- Check if code has reached max uses
  if v_code.max_uses is not null and v_code.current_uses >= v_code.max_uses then
    v_error_reason := 'Promo code usage limit reached';
    v_result := jsonb_build_object(
      'valid', false,
      'error', v_error_reason
    );
    
    -- Log attempt
    insert into promo_validation_attempts (promo_code, was_valid, error_reason)
    values (trim(_promo_code), false, v_error_reason);
    
    return v_result;
  end if;
  
  -- Verify admin still exists and has admin role
  if not exists (
    select 1 from user_roles 
    where user_id = v_code.admin_id and role = 'admin'
  ) then
    v_error_reason := 'Associated admin no longer exists';
    v_result := jsonb_build_object(
      'valid', false,
      'error', v_error_reason
    );
    
    -- Log attempt
    insert into promo_validation_attempts (promo_code, was_valid, error_reason)
    values (trim(_promo_code), false, v_error_reason);
    
    return v_result;
  end if;
  
  -- All checks passed - log successful validation
  insert into promo_validation_attempts (promo_code, was_valid)
  values (trim(_promo_code), true);
  
  return jsonb_build_object(
    'valid', true,
    'admin_id', v_code.admin_id,
    'code_id', v_code.id,
    'admin_name', (select email from user_profiles where user_id = v_code.admin_id)
  );
end;
$$;

-- Grant execute permission
grant execute on function public.validate_promo_code_for_signup(text) to anon, authenticated;