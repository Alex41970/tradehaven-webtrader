CREATE OR REPLACE FUNCTION public.signup_requires_promo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('admin', 'super_admin'));
$$;
REVOKE EXECUTE ON FUNCTION public.signup_requires_promo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.signup_requires_promo() TO anon, authenticated, service_role;