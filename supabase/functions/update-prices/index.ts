import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mock price generation for demo - in production, use real financial API
const generateRealisticPrice = (basePrice: number, volatility: number = 0.02): number => {
  const change = (Math.random() - 0.5) * 2 * volatility
  return basePrice * (1 + change)
}

const calculateChange24h = (currentPrice: number, previousPrice: number): number => {
  return ((currentPrice - previousPrice) / previousPrice) * 100
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = "https://stdfkfutgkmnaajixguz.supabase.co"
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch all active assets
    const { data: assets, error: fetchError } = await supabase
      .from('assets')
      .select('*')
      .eq('is_active', true)

    if (fetchError) {
      throw fetchError
    }

    if (!assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No assets found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update prices for all assets
    const updates = []
    for (const asset of assets) {
      const volatility = asset.category === 'forex' ? 0.005 : 
                        asset.category === 'crypto' ? 0.03 :
                        asset.category === 'stocks' ? 0.02 :
                        asset.category === 'commodities' ? 0.015 : 0.01

      const newPrice = generateRealisticPrice(asset.price, volatility)
      const change24h = calculateChange24h(newPrice, asset.price)

      updates.push({
        id: asset.id,
        price: Number(newPrice.toFixed(asset.category === 'forex' ? 5 : 2)),
        change_24h: Number(change24h.toFixed(4))
      })
    }

    // Batch update all prices
    const { error: updateError } = await supabase
      .from('assets')
      .upsert(updates)

    if (updateError) {
      throw updateError
    }

    // Update P&L for all open trades
    const { data: openTrades, error: tradesError } = await supabase
      .from('trades')
      .select(`
        id, user_id, asset_id, trade_type, amount, open_price, leverage,
        assets!inner(price)
      `)
      .eq('status', 'open')

    if (tradesError) {
      console.error('Error fetching trades:', tradesError)
    } else if (openTrades && openTrades.length > 0) {
      const tradeUpdates = openTrades.map(trade => {
        const currentPrice = (trade as any).assets.price
        const pnl = trade.trade_type === 'BUY' 
          ? trade.amount * trade.leverage * (currentPrice - trade.open_price)
          : trade.amount * trade.leverage * (trade.open_price - currentPrice)

        return {
          id: trade.id,
          current_price: currentPrice,
          pnl: Number(pnl.toFixed(2))
        }
      })

      const { error: tradeUpdateError } = await supabase
        .from('trades')
        .upsert(tradeUpdates)

      if (tradeUpdateError) {
        console.error('Error updating trades:', tradeUpdateError)
      }

      // Update user equity based on unrealized P&L
      const userPnLMap = new Map()
      openTrades.forEach(trade => {
        const pnl = trade.trade_type === 'BUY' 
          ? trade.amount * trade.leverage * ((trade as any).assets.price - trade.open_price)
          : trade.amount * trade.leverage * (trade.open_price - (trade as any).assets.price)
        
        userPnLMap.set(trade.user_id, (userPnLMap.get(trade.user_id) || 0) + pnl)
      })

      // Update user profiles with new equity
      for (const [userId, totalPnL] of userPnLMap.entries()) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('balance')
          .eq('user_id', userId)
          .single()

        if (profile) {
          await supabase
            .from('user_profiles')
            .update({ equity: profile.balance + totalPnL })
            .eq('user_id', userId)
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Prices updated successfully', 
        updated: updates.length,
        trades_updated: openTrades?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error updating prices:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})