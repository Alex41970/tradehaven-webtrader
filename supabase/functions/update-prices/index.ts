import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PriceData {
  symbol: string;
  price: number;
  change_24h: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting price update process...');

    // Get all active assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .eq('is_active', true);

    if (assetsError) {
      console.error('Error fetching assets:', assetsError);
      throw assetsError;
    }

    console.log(`Found ${assets?.length || 0} assets to update`);

    // Simulate real-time price updates (in production, you'd fetch from Alpha Vantage or another API)
    const priceUpdates: PriceData[] = assets?.map(asset => {
      // Generate realistic price movements
      const changePercent = (Math.random() - 0.5) * 0.1; // -5% to +5% change
      const newPrice = asset.price * (1 + changePercent);
      const change24h = newPrice - asset.price;
      
      return {
        symbol: asset.symbol,
        price: parseFloat(newPrice.toFixed(asset.category === 'forex' ? 5 : 2)),
        change_24h: parseFloat(change24h.toFixed(asset.category === 'forex' ? 5 : 2))
      };
    }) || [];

    console.log('Generated price updates:', priceUpdates.length);

    // Update prices in database
    for (const update of priceUpdates) {
      const { error: updateError } = await supabase
        .from('assets')
        .update({
          price: update.price,
          change_24h: update.change_24h,
          updated_at: new Date().toISOString()
        })
        .eq('symbol', update.symbol);

      if (updateError) {
        console.error(`Error updating ${update.symbol}:`, updateError);
      }
    }

    // Update P&L for all open trades
    const { data: openTrades, error: tradesError } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'open');

    if (tradesError) {
      console.error('Error fetching open trades:', tradesError);
    } else {
      console.log(`Updating P&L for ${openTrades?.length || 0} open trades`);
      
      for (const trade of openTrades || []) {
        const asset = assets?.find(a => a.id === trade.asset_id);
        if (asset) {
          const updatedPrice = priceUpdates.find(p => p.symbol === asset.symbol);
          if (updatedPrice) {
            const pnl = trade.trade_type === 'BUY' 
              ? trade.amount * (updatedPrice.price - trade.open_price)
              : trade.amount * (trade.open_price - updatedPrice.price);

            await supabase
              .from('trades')
              .update({
                current_price: updatedPrice.price,
                pnl: parseFloat(pnl.toFixed(2)),
                updated_at: new Date().toISOString()
              })
              .eq('id', trade.id);
          }
        }
      }
    }

    console.log('Price update completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: priceUpdates.length,
        message: 'Prices updated successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Price update failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})