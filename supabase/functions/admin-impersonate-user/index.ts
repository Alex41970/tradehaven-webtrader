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

    const { userId, adminId } = await req.json()

    console.log('Impersonation request:', { userId, adminId })

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

    // Get user email
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('user_id', userId)
      .single()

    if (!userProfile?.email) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate magic link for impersonation
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userProfile.email,
      options: { 
        redirectTo: `${req.headers.get('origin') || 'https://stdfkfutgkmnaajixguz.supabase.co'}/dashboard`
      }
    })

    if (linkError) {
      console.error('Magic link generation error:', linkError)
      throw linkError
    }

    console.log('Impersonation link generated for user:', userId)

    // Log impersonation action
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: adminId,
      user_id: userId,
      action: 'impersonation_started',
      reason: 'Admin logged in as user for support',
      old_value: { admin_session: 'active', admin_email: user.email },
      new_value: { 
        user_session: 'impersonated', 
        user_email: userProfile.email,
        timestamp: new Date().toISOString()
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        impersonationUrl: linkData.properties.action_link,
        userEmail: userProfile.email
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error creating impersonation session:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create impersonation session' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
