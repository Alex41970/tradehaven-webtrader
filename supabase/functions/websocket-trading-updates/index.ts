import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClientConnection {
  socket: WebSocket;
  userId: string;
  subscriptions: Set<string>;
}

const connections = new Map<string, ClientConnection>();

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgradeHeader = req.headers.get("upgrade") || "";
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders 
    });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  socket.onopen = () => {
    console.log("Trading WebSocket connection opened");
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Received message:", message);

      switch (message.type) {
        case 'auth':
          await handleAuth(socket, message);
          break;
        case 'subscribe':
          await handleSubscribe(socket, message);
          break;
        case 'trade_action':
          await handleTradeAction(socket, message);
          break;
        case 'ping':
          socket.send(JSON.stringify({ 
            type: 'pong',
            timestamp: message.timestamp || Date.now()
          }));
          break;
        default:
          console.log("Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("Error processing message:", error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  };

  socket.onclose = () => {
    console.log("Trading WebSocket connection closed");
    // Remove connection from active connections
    for (const [connectionId, connection] of connections.entries()) {
      if (connection.socket === socket) {
        connections.delete(connectionId);
        break;
      }
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  return response;
});

async function handleAuth(socket: WebSocket, message: any) {
  try {
    const { token } = message;
    
    // Verify JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      socket.send(JSON.stringify({
        type: 'auth_error',
        message: 'Invalid authentication token'
      }));
      return;
    }

    // Store authenticated connection
    const connectionId = crypto.randomUUID();
    connections.set(connectionId, {
      socket,
      userId: user.id,
      subscriptions: new Set()
    });

    console.log(`User ${user.id} authenticated via WebSocket`);
    
    // Fix margins before sending initial data
    await recalculateUserMargins(user.id);
    
    // Get fresh user data after margin fix
    const userProfile = await getUserProfile(user.id);
    const userTrades = await getUserTrades(user.id);

    socket.send(JSON.stringify({
      type: 'auth_success',
      user: {
        id: user.id,
        email: user.email
      },
      profile: userProfile,
      trades: userTrades
    }));

    // Send specific margin update for real-time display
    socket.send(JSON.stringify({
      type: 'margin_update',
      data: {
        userId: user.id,
        balance: userProfile?.balance || 0,
        usedMargin: userProfile?.used_margin || 0,
        availableMargin: userProfile?.available_margin || 0,
        equity: userProfile?.equity || 0
      }
    }));

  } catch (error) {
    console.error("Authentication error:", error);
    socket.send(JSON.stringify({
      type: 'auth_error',
      message: 'Authentication failed'
    }));
  }
}

async function handleSubscribe(socket: WebSocket, message: any) {
  try {
    const { channels } = message;
    
    // Find the connection for this socket
    let connection: ClientConnection | null = null;
    for (const conn of connections.values()) {
      if (conn.socket === socket) {
        connection = conn;
        break;
      }
    }

    if (!connection) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Not authenticated'
      }));
      return;
    }

    // Add subscriptions
    channels.forEach((channel: string) => {
      connection!.subscriptions.add(channel);
    });

    socket.send(JSON.stringify({
      type: 'subscribed',
      channels
    }));

  } catch (error) {
    console.error("Subscription error:", error);
    socket.send(JSON.stringify({
      type: 'error',
      message: 'Subscription failed'
    }));
  }
}

async function handleTradeAction(socket: WebSocket, message: any) {
  try {
    // Find the connection for this socket
    let connection: ClientConnection | null = null;
    for (const conn of connections.values()) {
      if (conn.socket === socket) {
        connection = conn;
        break;
      }
    }

    if (!connection) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Not authenticated'
      }));
      return;
    }

    const { action, data } = message;
    
    switch (action) {
      case 'open_trade':
        await handleOpenTrade(connection, data);
        break;
      case 'close_trade':
        await handleCloseTrade(connection, data);
        break;
      default:
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Unknown trade action'
        }));
    }

  } catch (error) {
    console.error("Trade action error:", error);
    socket.send(JSON.stringify({
      type: 'error',
      message: 'Trade action failed'
    }));
  }
}

async function handleOpenTrade(connection: ClientConnection, data: any) {
  try {
    console.log(`Opening trade for user ${connection.userId}:`, data);

    // ===== PHASE 1: INPUT VALIDATION =====
    if (!data.amount || data.amount <= 0) {
      throw new Error('Invalid trade amount');
    }

    if (!data.leverage || data.leverage < 1 || data.leverage > 1000) {
      throw new Error('Invalid leverage');
    }

    if (!data.openPrice || data.openPrice <= 0) {
      throw new Error('Invalid price');
    }

    // Get asset to check constraints
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('max_leverage, min_trade_size, symbol, price, price_updated_at')
      .eq('id', data.assetId)
      .single();

    if (assetError || !asset) {
      throw new Error('Asset not found');
    }

    if (data.amount < asset.min_trade_size) {
      throw new Error(`Minimum trade size is ${asset.min_trade_size}`);
    }

    // ===== PHASE 1: PRICE STALENESS VALIDATION =====
    const priceAge = asset.price_updated_at 
      ? Date.now() - new Date(asset.price_updated_at).getTime() 
      : Infinity;
    const STALE_TOLERANCE_MS = 60_000; // 60s tolerance while price backend is degraded

    if (!isFinite(priceAge)) {
      console.warn('Asset price has no timestamp; proceeding with client price.');
    } else if (priceAge > STALE_TOLERANCE_MS) {
      console.warn(`Bypassing staleness check (${(priceAge / 1000).toFixed(1)}s) due to degraded price feed.`);
    }

    // Calculate margin used
    const marginUsed = (data.amount * data.openPrice) / data.leverage;

    // ===== PHASE 1: BALANCE VALIDATION WITH LOCK =====
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('balance, equity, used_margin, available_margin')
      .eq('user_id', connection.userId)
      .single();

    if (profileError || !userProfile) {
      throw new Error('User profile not found');
    }

    if (userProfile.available_margin < marginUsed) {
      throw new Error(
        `Insufficient margin. Required: $${marginUsed.toFixed(2)}, Available: $${userProfile.available_margin.toFixed(2)}`
      );
    }

    // Generate idempotency key if not provided
    const idempotencyKey = data.idempotencyKey || crypto.randomUUID();

    // Insert new trade with idempotency protection
    const { data: newTrade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        user_id: connection.userId,
        asset_id: data.assetId,
        symbol: data.symbol,
        trade_type: data.tradeType,
        amount: data.amount,
        leverage: data.leverage,
        open_price: data.openPrice,
        current_price: data.openPrice,
        margin_used: marginUsed,
        status: 'open',
        stop_loss_price: data.stopLoss,
        take_profit_price: data.takeProfit,
        parent_order_id: data.parentOrderId,
        idempotency_key: idempotencyKey,
        slippage_percent: priceDeviation,
        price_age_ms: priceAge,
        trade_source: 'user'
      })
      .select()
      .single();

    if (tradeError) {
      console.error('Error inserting trade:', tradeError);
      if (tradeError.code === '23505') {
        throw new Error('Duplicate trade detected');
      }
      throw tradeError;
    }

    // ===== PHASE 1: AUDIT LOGGING =====
    await supabase.from('trade_execution_log').insert({
      trade_id: newTrade.id,
      user_id: connection.userId,
      action: 'open',
      requested_price: data.openPrice,
      executed_price: data.openPrice,
      slippage_percent: priceDeviation,
      execution_source: data.tradeSource || 'user',
      executed_at: new Date().toISOString(),
    });

    // Recalculate margins
    await recalculateUserMargins(connection.userId);

    // Get updated profile
    const profile = await getUserProfile(connection.userId);
    const trades = await getUserTrades(connection.userId);

    // Broadcast trade opened
    connection.socket.send(JSON.stringify({
      type: 'trade_opened',
      trade: newTrade,
      profile,
      trades,
    }));

    console.log('Trade opened successfully via WebSocket:', newTrade.id);
  } catch (error) {
    console.error('Error opening trade:', error);
    connection.socket.send(JSON.stringify({
      type: 'trade_error',
      message: error.message || 'Failed to open trade'
    }));
  }
}

async function handleCloseTrade(connection: ClientConnection, data: any) {
  try {
    console.log(`Closing trade for user ${connection.userId}:`, data);

    // ===== PHASE 1: PRICE STALENESS CHECK =====
    const { data: asset } = await supabase
      .from('assets')
      .select('price, price_updated_at, symbol')
      .eq('symbol', data.symbol)
      .single();

  if (asset && asset.price_updated_at) {
      const priceAge = Date.now() - new Date(asset.price_updated_at).getTime();
      const STALE_TOLERANCE_MS = 60_000; // allow 60s while price backend is degraded
      if (priceAge > STALE_TOLERANCE_MS) {
        console.warn(`Bypassing close staleness check (${(priceAge / 1000).toFixed(1)}s) due to degraded price feed.`);
      }
    }

    // Close the trade using RPC function
    const { data: result, error: closeError } = await supabase.rpc('close_trade_with_pnl', {
      p_trade_id: data.tradeId,
      p_close_price: data.closePrice,
    });

    if (closeError || result?.error) {
      throw new Error(result?.error || closeError.message);
    }

    console.log(`Trade closed. P&L: ${result.pnl}`);

    // ===== PHASE 1: AUDIT LOGGING =====
    await supabase.from('trade_execution_log').insert({
      trade_id: data.tradeId,
      user_id: connection.userId,
      action: 'close',
      executed_price: data.closePrice,
      execution_source: data.source || 'user',
      executed_at: new Date().toISOString(),
    });

    // Recalculate user margins
    await recalculateUserMargins(connection.userId);

    // Get updated data
    const profile = await getUserProfile(connection.userId);
    const trades = await getUserTrades(connection.userId);

    // Broadcast trade closed
    connection.socket.send(JSON.stringify({
      type: 'trade_closed',
      tradeId: data.tradeId,
      pnl: result.pnl,
      closePrice: data.closePrice,
      profile,
      trades,
    }));

    console.log('Trade closed successfully via WebSocket:', data.tradeId, 'P&L:', result.pnl);
  } catch (error) {
    console.error('Error closing trade:', error);
    connection.socket.send(JSON.stringify({
      type: 'trade_error',
      message: error.message || 'Failed to close trade'
    }));
  }
}

async function recalculateUserMargins(userId: string) {
  try {
    console.log('Recalculating margins for user:', userId);

    // Calculate totals
    let totalUsedMargin = 0;
    let totalClosedPnL = 0;
    let totalUnrealizedPnL = 0;
    const baseBalance = 10000.00;

    // Get open trades with full details for unrealized PnL calculation
    const { data: openTrades, error: openError } = await supabase
      .from('trades')
      .select('margin_used, symbol, trade_type, amount, open_price, leverage')
      .eq('user_id', userId)
      .eq('status', 'open');

    if (!openError && openTrades) {
      totalUsedMargin = openTrades.reduce((sum, trade) => sum + (trade.margin_used || 0), 0);
      
      // Get current market prices for all symbols in open trades
      if (openTrades.length > 0) {
        const symbols = [...new Set(openTrades.map(trade => trade.symbol))];
        const { data: assetPrices, error: priceError } = await supabase
          .from('assets')
          .select('symbol, price')
          .in('symbol', symbols);

        if (!priceError && assetPrices) {
          const priceMap = new Map(assetPrices.map(asset => [asset.symbol, asset.price]));
          
          // Calculate unrealized PnL for each open trade
          totalUnrealizedPnL = openTrades.reduce((sum, trade) => {
            const currentPrice = priceMap.get(trade.symbol);
            if (!currentPrice || isNaN(currentPrice) || !trade.open_price || isNaN(trade.open_price)) {
              return sum;
            }

            const amount = Number(trade.amount);
            const openPrice = Number(trade.open_price);
            const leverage = Number(trade.leverage) || 1;

            let pnl = 0;
            if (trade.trade_type === 'BUY') {
              pnl = amount * (currentPrice - openPrice) * leverage;
            } else {
              pnl = amount * (openPrice - currentPrice) * leverage;
            }

            return sum + pnl;
          }, 0);
        }
      }
    }

    // Get closed trades P&L
    const { data: closedTrades, error: closedError } = await supabase
      .from('trades')
      .select('pnl')
      .eq('user_id', userId)
      .eq('status', 'closed');

    if (!closedError && closedTrades) {
      totalClosedPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    }

    const newBalance = baseBalance + totalClosedPnL;
    // Don't include unrealized P&L in stored equity - frontend will add it real-time
    const equity = newBalance; // Same as balance, frontend adds unrealized P&L
    const availableMargin = Math.max(newBalance - totalUsedMargin, 0);

    // Update user profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        balance: newBalance,
        equity: equity,
        used_margin: totalUsedMargin,
        available_margin: availableMargin,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating user profile:', updateError);
      return false;
    }

    console.log('Margins updated:', {
      userId,
      balance: newBalance,
      equity: equity, // Now same as balance, frontend adds unrealized P&L
      usedMargin: totalUsedMargin,
      availableMargin,
      unrealizedPnL: totalUnrealizedPnL,
      note: 'Equity = balance (no unrealized P&L), frontend will add real-time P&L'
    });

    // Broadcast margin update to connected user immediately
    broadcastToUser(userId, {
      type: 'margin_update',
      data: {
        userId,
        balance: newBalance, // Base + closed P&L only
        usedMargin: totalUsedMargin,
        availableMargin,
        equity: equity // Same as balance, frontend adds unrealized P&L
      }
    });

    return true;
  } catch (error) {
    console.error('Error recalculating margins:', error);
    return false;
  }
}

async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
  
  return data;
}

async function getUserTrades(userId: string) {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('opened_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching user trades:', error);
    return [];
  }
  
  return data || [];
}

// Broadcast updates to all connected clients
export async function broadcastToUser(userId: string, message: any) {
  for (const connection of connections.values()) {
    if (connection.userId === userId) {
      try {
        connection.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error broadcasting to user:', error);
      }
    }
  }
}