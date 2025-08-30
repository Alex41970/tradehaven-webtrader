-- Clean up excess user assignments to restore original working state
-- Keep only 3@1.com and 11@1.com assigned to admin 2@1.com

-- Get the admin_id for 2@1.com
DO $$
DECLARE
    admin_2_id UUID;
    user_3_id UUID;
    user_11_id UUID;
BEGIN
    -- Get admin ID for 2@1.com
    SELECT user_id INTO admin_2_id FROM user_profiles WHERE email = '2@1.com';
    
    -- Get user IDs for the users we want to keep
    SELECT user_id INTO user_3_id FROM user_profiles WHERE email = '3@1.com';
    SELECT user_id INTO user_11_id FROM user_profiles WHERE email = '11@1.com';
    
    -- Remove excess admin_user_relationships (keep only 3@1.com and 11@1.com)
    DELETE FROM admin_user_relationships 
    WHERE admin_id = admin_2_id 
    AND user_id NOT IN (user_3_id, user_11_id);
    
    -- Set admin_id to NULL for users that should not be assigned to any admin
    UPDATE user_profiles 
    SET admin_id = NULL, 
        assignment_method = NULL,
        assigned_at = NULL,
        promo_code_used = NULL
    WHERE email IN ('5@1.com', '6@1.com', '7@1.com', '8@1.com', '10@1.com');
    
    -- Ensure the correct users are still assigned
    UPDATE user_profiles 
    SET admin_id = admin_2_id,
        assignment_method = 'manual',
        assigned_at = now()
    WHERE email IN ('3@1.com', '11@1.com');
    
    RAISE NOTICE 'Cleaned up user assignments. Admin 2@1.com now has only 3@1.com and 11@1.com assigned.';
END $$;