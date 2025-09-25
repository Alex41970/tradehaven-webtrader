import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

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
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting daily price snapshot storage...');

    // Get all active assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('symbol, price, change_24h')
      .eq('is_active', true);

    if (assetsError) {
      throw assetsError;
    }

    if (!assets || assets.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No active assets found' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Storing snapshots for ${assets.length} assets...`);

    // Store today's price snapshots
    const snapshots = assets.map(asset => ({
      symbol: asset.symbol,
      price: asset.price,
      change_24h: asset.change_24h,
      snapshot_date: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
    }));

    // Upsert snapshots (insert or update if exists)
    const { data: insertedSnapshots, error: insertError } = await supabase
      .from('price_history')
      .upsert(snapshots, { 
        onConflict: 'symbol,snapshot_date',
        ignoreDuplicates: false 
      })
      .select();

    if (insertError) {
      console.error('Error inserting snapshots:', insertError);
      throw insertError;
    }

    console.log(`Successfully stored ${insertedSnapshots?.length || 0} price snapshots`);

    // Clean up old snapshots (keep only last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error: deleteError } = await supabase
      .from('price_history')
      .delete()
      .lt('snapshot_date', thirtyDaysAgo.toISOString().split('T')[0]);

    if (deleteError) {
      console.warn('Error cleaning up old snapshots:', deleteError);
    } else {
      console.log('Cleaned up snapshots older than 30 days');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      snapshots_stored: insertedSnapshots?.length || 0,
      message: 'Daily price snapshots stored successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in store-daily-snapshots function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
