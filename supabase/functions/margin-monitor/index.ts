import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MarginLevel {
  userId: string;
  equity: number;
  usedMargin: number;
  marginLevel: number;
  openTrades: any[];
}

Deno.serve(async (req) => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🔍 Starting margin level check...');

    // Get all users with open trades
    const { data: openTrades, error: tradesError } = await supabase
      .from('trades')
      .select('id, user_id, symbol, trade_type, amount, leverage, open_price, margin_used, pnl')
      .eq('status', 'open');

    if (tradesError) throw tradesError;

    if (!openTrades || openTrades.length === 0) {
      console.log('✅ No open trades to monitor');
      return new Response(JSON.stringify({ message: 'No open trades' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Group trades by user
    const userTrades = new Map<string, any[]>();
    openTrades.forEach(trade => {
      const trades = userTrades.get(trade.user_id) || [];
      trades.push(trade);
      userTrades.set(trade.user_id, trades);
    });

    console.log(`📊 Monitoring ${userTrades.size} users with open positions`);

    // Get all assets for price calculation
    const { data: assets } = await supabase
      .from('assets')
      .select('id, symbol, price');

    const priceMap = new Map(assets?.map(a => [a.symbol, a.price]) || []);

    const marginLevels: MarginLevel[] = [];
    const usersToStopOut: string[] = [];
    const usersToWarn: string[] = [];

    // Check margin level for each user
    for (const [userId, trades] of userTrades) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('balance, equity, used_margin')
        .eq('user_id', userId)
        .single();

      if (!profile) continue;

      // Calculate real-time unrealized P&L
      let totalUnrealizedPnL = 0;
      trades.forEach(trade => {
        const currentPrice = priceMap.get(trade.symbol) || trade.open_price;
        const priceDiff = trade.trade_type === 'BUY'
          ? currentPrice - trade.open_price
          : trade.open_price - currentPrice;
        const unrealizedPnL = priceDiff * trade.amount * trade.leverage;
        totalUnrealizedPnL += unrealizedPnL;
      });

      const realTimeEquity = profile.balance + totalUnrealizedPnL;
      const usedMargin = profile.used_margin || 0;

      // Margin Level = (Equity / Used Margin) × 100%
      const marginLevel = usedMargin > 0 ? (realTimeEquity / usedMargin) * 100 : 999;

      marginLevels.push({
        userId,
        equity: realTimeEquity,
        usedMargin,
        marginLevel,
        openTrades: trades,
      });

      console.log(`👤 User ${userId.slice(0, 8)}: Margin Level ${marginLevel.toFixed(2)}%, Equity: $${realTimeEquity.toFixed(2)}`);

      // STOP-OUT LEVEL: 50% - Close all positions
      if (marginLevel <= 50 || realTimeEquity <= 0) {
        console.log(`🚨 STOP-OUT triggered for user ${userId.slice(0, 8)} at ${marginLevel.toFixed(2)}%`);
        usersToStopOut.push(userId);

        // Close all trades starting with largest losing trade
        const sortedTrades = trades
          .map(trade => {
            const currentPrice = priceMap.get(trade.symbol) || trade.open_price;
            const priceDiff = trade.trade_type === 'BUY'
              ? currentPrice - trade.open_price
              : trade.open_price - currentPrice;
            const unrealizedPnL = priceDiff * trade.amount * trade.leverage;
            return { ...trade, currentPrice, unrealizedPnL };
          })
          .sort((a, b) => a.unrealizedPnL - b.unrealizedPnL); // Worst losses first

        for (const trade of sortedTrades) {
          console.log(`  📉 Auto-closing ${trade.symbol} ${trade.trade_type} with P&L: $${trade.unrealizedPnL.toFixed(2)}`);

          // Close the trade
          const { error: closeError } = await supabase.rpc('close_trade_with_pnl', {
            p_trade_id: trade.id,
            p_close_price: trade.currentPrice,
          });

          if (closeError) {
            console.error(`  ❌ Failed to close trade ${trade.id}:`, closeError);
          } else {
            console.log(`  ✅ Trade ${trade.id} closed at ${trade.currentPrice}`);
          }
        }

        // Recalculate margins after closing trades
        await recalculateUserMargins(supabase, userId);

        // Log stop-out event
        await supabase.from('trade_execution_log').insert({
          user_id: userId,
          action: 'stop_out',
          execution_source: 'margin_monitor',
          executed_at: new Date().toISOString(),
        });
      }
      // MARGIN CALL: 100% - Warning only
      else if (marginLevel <= 100) {
        console.log(`⚠️  MARGIN CALL warning for user ${userId.slice(0, 8)} at ${marginLevel.toFixed(2)}%`);
        usersToWarn.push(userId);

        // Log margin call warning
        await supabase.from('trade_execution_log').insert({
          user_id: userId,
          action: 'margin_call_warning',
          execution_source: 'margin_monitor',
          executed_at: new Date().toISOString(),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        monitored: userTrades.size,
        marginLevels,
        stopOuts: usersToStopOut.length,
        marginCalls: usersToWarn.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Margin monitor error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function recalculateUserMargins(supabase: any, userId: string) {
  const { data: openTrades } = await supabase
    .from('trades')
    .select('margin_used, pnl')
    .eq('user_id', userId)
    .eq('status', 'open');

  const { data: closedTrades } = await supabase
    .from('trades')
    .select('pnl')
    .eq('user_id', userId)
    .eq('status', 'closed');

  const totalUsedMargin = openTrades?.reduce((sum, t) => sum + Number(t.margin_used), 0) || 0;
  const totalRealizedPnL = closedTrades?.reduce((sum, t) => sum + Number(t.pnl || 0), 0) || 0;

  const initialBalance = 10000;
  const newBalance = initialBalance + totalRealizedPnL;
  const newEquity = newBalance;
  const newAvailableMargin = newBalance - totalUsedMargin;

  await supabase
    .from('user_profiles')
    .update({
      balance: newBalance,
      equity: newEquity,
      used_margin: totalUsedMargin,
      available_margin: newAvailableMargin,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  console.log(`  💰 Margins recalculated: Balance=$${newBalance}, Used=$${totalUsedMargin}, Available=$${newAvailableMargin}`);
}
