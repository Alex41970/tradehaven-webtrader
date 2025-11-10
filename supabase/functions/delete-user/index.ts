import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get the user from the auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify the caller is a super admin using the has_role function
    const { data: isSuperAdmin, error: roleError } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'super_admin'
    });

    if (roleError) {
      console.error('Error checking super admin role:', roleError);
      throw new Error('Failed to verify permissions');
    }

    if (!isSuperAdmin) {
      throw new Error('Only super admins can delete users');
    }

    // Get the user_id to delete from the request body
    const { user_id } = await req.json();
    
    if (!user_id) {
      throw new Error('user_id is required');
    }

    // Prevent self-deletion
    if (user_id === user.id) {
      throw new Error('Cannot delete your own account');
    }

    // Check if the target user is a super admin
    const { data: isTargetSuperAdmin, error: targetRoleError } = await supabaseClient.rpc('has_role', {
      _user_id: user_id,
      _role: 'super_admin'
    });

    if (targetRoleError) {
      console.error('Error checking target user role:', targetRoleError);
      throw new Error('Failed to verify target user permissions');
    }

    if (isTargetSuperAdmin) {
      throw new Error('Cannot delete other super admin accounts');
    }

    console.log('Deleting user:', user_id);

    // Delete the user from auth.users using admin API
    // This will cascade delete all related data due to ON DELETE CASCADE
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(user_id);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      throw new Error(`Failed to delete user: ${deleteError.message}`);
    }

    console.log('User deleted successfully:', user_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User deleted successfully',
        deleted_user_id: user_id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Delete user error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to delete user' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
