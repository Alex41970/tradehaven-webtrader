-- Add new required fields to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN first_name TEXT,
ADD COLUMN surname TEXT,
ADD COLUMN phone_number TEXT;

-- Update the handle_new_user function to extract user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert user profile with metadata
  INSERT INTO public.user_profiles (
    user_id, 
    email, 
    first_name,
    surname,
    phone_number,
    balance, 
    equity, 
    available_margin
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'surname',
    NEW.raw_user_meta_data ->> 'phone_number',
    10000.00,
    10000.00,
    10000.00
  );
  
  -- Insert default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;