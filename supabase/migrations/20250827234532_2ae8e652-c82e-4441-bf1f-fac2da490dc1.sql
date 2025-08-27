-- Make 1@1.com a super admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('b3cd8a5c-37e9-4265-a545-287ad461461b', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;