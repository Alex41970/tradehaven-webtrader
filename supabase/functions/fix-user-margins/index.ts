import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate total margin used by open trades
    const { data: openTrades, error: tradesError } = await supabaseClient
      .from('trades')
      .select('margin_used')
      .eq('user_id', user_id)
      .eq('status', 'open');

    if (tradesError) {
      throw tradesError;
    }

    const totalUsedMargin = openTrades?.reduce((sum, trade) => sum + (trade.margin_used || 0), 0) || 0;

    // Calculate total P&L from closed trades
    const { data: closedTrades, error: pnlError } = await supabaseClient
      .from('trades')
      .select('pnl')
      .eq('user_id', user_id)
      .eq('status', 'closed');

    if (pnlError) {
      throw pnlError;
    }

    const totalClosedPnl = closedTrades?.reduce((sum, trade) => sum + (trade.pnl || 0), 0) || 0;

    // Calculate new balance
    const baseBalance = 10000.00;
    const newBalance = baseBalance + totalClosedPnl;
    const availableMargin = Math.max(newBalance - totalUsedMargin, 0);

    // Update user profile with correct values
    const { error: updateError } = await supabaseClient
      .from('user_profiles')
      .update({
        balance: newBalance,
        used_margin: totalUsedMargin,
        available_margin: availableMargin,
        equity: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        balance: newBalance,
        used_margin: totalUsedMargin,
        available_margin: availableMargin,
        equity: newBalance,
        message: 'Margins fixed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fixing margins:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});