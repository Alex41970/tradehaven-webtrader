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
        credit: userProfile?.credit || 0,
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

    if (!data.leverage || data.leverage < 1 || data.leverage > 100) {
      throw new Error('Leverage must be between 1 and 100');
    }

    if (!data.openPrice || data.openPrice <= 0) {
      throw new Error('Invalid price');
    }

    // Get asset to check constraints
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('max_leverage, min_trade_size, symbol, price, price_updated_at, contract_size')
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
    // Lots x contract size x price / leverage (the database re-checks price and margin on insert)
    const marginUsed = (data.amount * (Number(asset.contract_size) || 1) * data.openPrice) / data.leverage;

    // Free margin (balance + credit + open P&L - margin in use) is checked by the database
    // when the trade is inserted, with the account locked, so two orders cannot spend it twice.

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
        // Never taken from the client: only the server fills pending orders (it would skip the market-hours check)
        parent_order_id: null,
        idempotency_key: idempotencyKey,
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
      throw new Error(tradeError.message || 'Failed to open trade');
    }

    // ===== PHASE 1: AUDIT LOGGING =====
    await supabase.from('trade_execution_log').insert({
      trade_id: newTrade.id,
      user_id: connection.userId,
      action: 'open',
      requested_price: data.openPrice,
      executed_price: newTrade.open_price,
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
      requestId: data.requestId,
      trade: newTrade,
      profile,
      trades,
    }));

    console.log('Trade opened successfully via WebSocket:', newTrade.id);
  } catch (error) {
    console.error('Error opening trade:', error);
    connection.socket.send(JSON.stringify({
      type: 'trade_error',
      requestId: data?.requestId,
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

    // This function runs with full database access, so it must check itself that the
    // trade belongs to the person who is connected before closing it.
    const { data: ownTrade } = await supabase
      .from('trades')
      .select('id')
      .eq('id', data.tradeId)
      .eq('user_id', connection.userId)
      .maybeSingle();

    if (!ownTrade) {
      throw new Error('Trade not found or already closed');
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
      requested_price: data.closePrice,
      executed_price: result.close_price ?? data.closePrice,
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
      requestId: data.requestId,
      tradeId: data.tradeId,
      pnl: result.pnl,
      closePrice: result.close_price ?? data.closePrice,
      tradeSource: data.tradeSource || 'user',
      profile,
      trades,
    }));

    console.log('Trade closed successfully via WebSocket:', data.tradeId, 'P&L:', result.pnl);
  } catch (error) {
    console.error('Error closing trade:', error);
    connection.socket.send(JSON.stringify({
      type: 'trade_error',
      requestId: data?.requestId,
      message: error.message || 'Failed to close trade'
    }));
  }
}

// Account figures (margin in use, equity, free margin) are derived by the database:
// equity = balance + credit + open P&L. This only asks the database to refresh them and
// tells the connected user the result.
async function recalculateUserMargins(userId: string) {
  try {
    const { error: refreshError } = await supabase.rpc('auto_recalculate_user_margins', { _user_id: userId });
    if (refreshError) {
      console.error('Error refreshing account figures:', refreshError);
      return false;
    }

    const profile = await getUserProfile(userId);
    if (!profile) return false;

    broadcastToUser(userId, {
      type: 'margin_update',
      data: {
        userId,
        balance: profile.balance || 0,
        credit: profile.credit || 0,
        usedMargin: profile.used_margin || 0,
        availableMargin: profile.available_margin || 0,
        equity: profile.equity || 0
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