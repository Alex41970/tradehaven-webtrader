-- Clean up duplicate user roles and add constraints to prevent future duplicates

-- First, create a function to clean up duplicate roles keeping the highest priority role
CREATE OR REPLACE FUNCTION clean_duplicate_user_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For users with multiple roles, keep only the highest priority role
  -- Priority: super_admin > admin > user
  
  -- Delete lower priority duplicate roles
  DELETE FROM user_roles ur1
  WHERE EXISTS (
    SELECT 1 FROM user_roles ur2 
    WHERE ur2.user_id = ur1.user_id 
    AND ur2.id != ur1.id
    AND (
      -- If user has super_admin, remove admin and user roles
      (ur2.role = 'super_admin' AND ur1.role IN ('admin', 'user'))
      OR
      -- If user has admin, remove user role
      (ur2.role = 'admin' AND ur1.role = 'user')
    )
  );
  
  -- Log the cleanup
  RAISE NOTICE 'Duplicate user roles cleanup completed';
END;
$$;

-- Execute the cleanup function
SELECT clean_duplicate_user_roles();

-- Drop the cleanup function as it's no longer needed
DROP FUNCTION clean_duplicate_user_roles();

-- Add a unique constraint to prevent multiple roles per user
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_unique;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- Create a function to validate role transitions
CREATE OR REPLACE FUNCTION validate_role_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- For INSERT operations, check if user already has a role
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'User already has a role assigned. Use UPDATE to change roles.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce single role per user
CREATE TRIGGER enforce_single_role_per_user
  BEFORE INSERT ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION validate_role_transition();