import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('🔍 Starting order monitor cycle...');
    
    // Early exit if no trades or orders need monitoring (performance optimization)
    const { data: quickCheck } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .or('stop_loss_price.not.is.null,take_profit_price.not.is.null');
    
    const { data: orderCheck } = await supabase
      .from('trade_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .not('expires_at', 'is', null);
    
    // If no SL/TP trades and no pending orders, exit early
    if ((!quickCheck || quickCheck.length === 0) && (!orderCheck || orderCheck.length === 0)) {
      const executionTime = Date.now() - startTime;
      console.log(`⚡ No monitoring needed - early exit (${executionTime}ms)`);
      return new Response(JSON.stringify({
        success: true,
        ordersProcessed: 0,
        tradesProcessed: 0,
        executionTime,
        message: 'No monitoring required - system idle'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Get all pending orders
    const { data: pendingOrders, error: ordersError } = await supabase
      .from('trade_orders')
      .select(`
        *,
        assets!inner(symbol, price, contract_size, category)
      `)
      .eq('status', 'pending')
      .not('expires_at', 'is', null)
      .lt('expires_at', new Date().toISOString());

    if (ordersError) {
      console.error('Error fetching pending orders:', ordersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch orders' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all open trades with stop-loss or take-profit
    const { data: openTrades, error: tradesError } = await supabase
      .from('trades')
      .select(`
        *,
        assets!inner(symbol, price, contract_size, category)
      `)
      .eq('status', 'open')
      .or('stop_loss_price.not.is.null,take_profit_price.not.is.null');

    if (tradesError) {
      console.error('Error fetching open trades:', tradesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch trades' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let ordersProcessed = 0;
    let tradesProcessed = 0;

    // Process pending orders
    if (pendingOrders && pendingOrders.length > 0) {
      console.log(`📋 Processing ${pendingOrders.length} pending orders...`);
      
      for (const order of pendingOrders) {
        const currentPrice = order.assets.price;
        let shouldExecute = false;

        // Check if order should be executed
        if (order.order_type === 'limit') {
          if (order.trade_type === 'BUY' && currentPrice <= order.trigger_price) {
            shouldExecute = true;
          } else if (order.trade_type === 'SELL' && currentPrice >= order.trigger_price) {
            shouldExecute = true;
          }
        } else if (order.order_type === 'stop') {
          if (order.trade_type === 'BUY' && currentPrice >= order.trigger_price) {
            shouldExecute = true;
          } else if (order.trade_type === 'SELL' && currentPrice <= order.trigger_price) {
            shouldExecute = true;
          }
        }

        if (shouldExecute) {
          await executeOrder(order, currentPrice);
          ordersProcessed++;
        }
      }
    }

    // Process stop-loss and take-profit for open trades
    if (openTrades && openTrades.length > 0) {
      console.log(`🎯 Processing ${openTrades.length} trades with SL/TP...`);
      
      for (const trade of openTrades) {
        const currentPrice = trade.assets.price;
        let shouldClose = false;
        let closeReason = '';

        // Check stop-loss
        if (trade.stop_loss_price) {
          if (trade.trade_type === 'BUY' && currentPrice <= trade.stop_loss_price) {
            shouldClose = true;
            closeReason = 'stop_loss';
          } else if (trade.trade_type === 'SELL' && currentPrice >= trade.stop_loss_price) {
            shouldClose = true;
            closeReason = 'stop_loss';
          }
        }

        // Check take-profit
        if (!shouldClose && trade.take_profit_price) {
          if (trade.trade_type === 'BUY' && currentPrice >= trade.take_profit_price) {
            shouldClose = true;
            closeReason = 'take_profit';
          } else if (trade.trade_type === 'SELL' && currentPrice <= trade.take_profit_price) {
            shouldClose = true;
            closeReason = 'take_profit';
          }
        }

        if (shouldClose) {
          await closeTrade(trade, currentPrice, closeReason);
          tradesProcessed++;
        }
      }
    }

    console.log(`✅ Order monitoring complete: ${ordersProcessed} orders executed, ${tradesProcessed} trades closed`);

    const executionTime = Date.now() - startTime;
    console.log(`⚡ Monitor cycle completed in ${executionTime}ms`);

    return new Response(JSON.stringify({
      success: true,
      ordersProcessed,
      tradesProcessed,
      executionTime,
      message: `Order monitoring completed successfully in ${executionTime}ms`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Order monitor error:', error);
    return new Response(JSON.stringify({ 
      error: 'Order monitoring failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function executeOrder(order: any, currentPrice: number) {
  try {
    console.log(`⚡ Executing order ${order.id} for ${order.symbol} at ${currentPrice}`);
    
    // Calculate margin required
    const marginUsed = order.assets.category === 'forex'
      ? (order.assets.contract_size * currentPrice) / order.leverage
      : (order.amount * currentPrice) / order.leverage;

    // Check if user has sufficient margin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('available_margin')
      .eq('user_id', order.user_id)
      .single();

    if (!userProfile || userProfile.available_margin < marginUsed) {
      console.log(`❌ Insufficient margin for order ${order.id}`);
      
      // Cancel order due to insufficient margin
      await supabase
        .from('trade_orders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      
      return;
    }

    // Execute the order by creating a trade
    const { data: newTrade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        user_id: order.user_id,
        asset_id: order.asset_id,
        symbol: order.symbol,
        trade_type: order.trade_type,
        amount: order.amount,
        leverage: order.leverage,
        open_price: currentPrice,
        current_price: currentPrice,
        margin_used: marginUsed,
        stop_loss_price: order.stop_loss_price,
        take_profit_price: order.take_profit_price,
        status: 'open',
        trade_source: 'order'
      })
      .select()
      .single();

    if (tradeError) {
      console.error('Error creating trade from order:', tradeError);
      return;
    }

    // Mark order as filled
    await supabase
      .from('trade_orders')
      .update({
        status: 'filled',
        filled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    // Recalculate user margins
    await recalculateUserMargins(order.user_id);

    console.log(`✅ Order ${order.id} executed successfully, created trade ${newTrade.id}`);
    
    // Broadcast to user via WebSocket if possible
    await broadcastTradeUpdate(order.user_id, {
      type: 'order_filled',
      order: { ...order, status: 'filled' },
      trade: newTrade
    });

  } catch (error) {
    console.error(`Error executing order ${order.id}:`, error);
  }
}

async function closeTrade(trade: any, currentPrice: number, reason: string) {
  try {
    console.log(`🎯 Closing trade ${trade.id} (${reason}) for ${trade.symbol} at ${currentPrice}`);
    
    // Use the proper RPC that handles balance updates correctly
    const { data: closeResult, error: closeError } = await supabase
      .rpc('close_trade_with_pnl', {
        p_trade_id: trade.id,
        p_close_price: currentPrice
      });

    if (closeError) {
      console.error('Error closing trade via RPC:', closeError);
      return;
    }

    if (closeResult?.error) {
      console.error('Trade closure returned error:', closeResult.error);
      return;
    }

    console.log(`✅ Trade ${trade.id} closed via ${reason}`);
    console.log(`   P&L: $${closeResult.pnl}`);
    console.log(`   New balance: $${closeResult.new_balance}`);
    
    // Broadcast to user via WebSocket
    await broadcastTradeUpdate(trade.user_id, {
      type: 'trade_auto_closed',
      trade: { 
        ...trade, 
        close_price: closeResult.close_price, 
        pnl: closeResult.pnl, 
        status: 'closed' 
      },
      reason,
      new_balance: closeResult.new_balance
    });

  } catch (error) {
    console.error(`Error closing trade ${trade.id}:`, error);
  }
}

async function recalculateUserMargins(userId: string) {
  try {
    // Get CURRENT balance (preserves admin deposits!)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('balance')
      .eq('user_id', userId)
      .single();
    
    const currentBalance = profile?.balance || 0;
    console.log('Recalculating margins - current balance (preserved):', currentBalance);

    let totalUsedMargin = 0;

    // Get open trades
    const { data: openTrades, error: openError } = await supabase
      .from('trades')
      .select('margin_used')
      .eq('user_id', userId)
      .eq('status', 'open');

    if (!openError && openTrades) {
      totalUsedMargin = openTrades.reduce((sum, trade) => sum + (trade.margin_used || 0), 0);
    }

    const availableMargin = Math.max(currentBalance - totalUsedMargin, 0);

    // Update ONLY margins (preserve balance!)
    await supabase
      .from('user_profiles')
      .update({
        used_margin: totalUsedMargin,
        available_margin: availableMargin,
        equity: currentBalance, // Frontend adds unrealized P&L
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    console.log('Margins updated - balance preserved:', currentBalance, 'used:', totalUsedMargin, 'available:', availableMargin);

  } catch (error) {
    console.error('Error recalculating margins:', error);
  }
}

async function broadcastTradeUpdate(userId: string, data: any) {
  try {
    // Try to call the websocket function to broadcast update
    const { error } = await supabase.functions.invoke('websocket-trading-updates', {
      body: {
        type: 'broadcast',
        userId,
        data
      }
    });

    if (error) {
      console.log('Could not broadcast to WebSocket (user may not be connected)');
    }
  } catch (error) {
    console.log('WebSocket broadcast failed (expected if user not connected)');
  }
}