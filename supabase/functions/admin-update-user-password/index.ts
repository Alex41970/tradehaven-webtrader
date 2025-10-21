import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { userId, newPassword, adminId } = await req.json()

    console.log('Password update request:', { userId, adminId, passwordLength: newPassword?.length })

    // Verify admin has access to this user (or is super admin)
    const { data: isSuperAdmin } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', adminId)
      .eq('role', 'super_admin')
      .single()

    if (!isSuperAdmin) {
      const { data: relationship } = await supabaseAdmin
        .from('admin_user_relationships')
        .select('*')
        .eq('admin_id', adminId)
        .eq('user_id', userId)
        .single()

      if (!relationship) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: No access to this user' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Get user email for logging
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('user_id', userId)
      .single()

    // Update user password using Admin API
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Password update error:', updateError)
      throw updateError
    }

    console.log('Password updated successfully for user:', userId)

    // Log action to audit trail
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: adminId,
      user_id: userId,
      action: 'password_updated',
      reason: 'Tech support password reset',
      old_value: { note: 'Password changed by admin', user_email: userProfile?.email },
      new_value: { note: 'New password set', timestamp: new Date().toISOString() }
    })

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error updating password:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update password' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
