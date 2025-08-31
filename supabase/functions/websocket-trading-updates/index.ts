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
    const {
      assetId,
      symbol,
      tradeType,
      amount,
      leverage,
      openPrice,
      marginUsed
    } = data;

    console.log('Opening trade via WebSocket:', { symbol, tradeType, amount, leverage });

    // Insert trade into database
    const { data: newTrade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        user_id: connection.userId,
        asset_id: assetId,
        symbol,
        trade_type: tradeType,
        amount,
        leverage,
        open_price: openPrice,
        current_price: openPrice,
        margin_used: marginUsed,
        status: 'open',
        trade_source: 'user'
      })
      .select()
      .single();

    if (tradeError) {
      console.error('Error opening trade:', tradeError);
      connection.socket.send(JSON.stringify({
        type: 'trade_error',
        message: 'Failed to open trade',
        error: tradeError.message
      }));
      return;
    }

    // Recalculate margins immediately
    await recalculateUserMargins(connection.userId);

    // Get updated user profile and trades
    const updatedProfile = await getUserProfile(connection.userId);
    const updatedTrades = await getUserTrades(connection.userId);

    // Broadcast to user
    connection.socket.send(JSON.stringify({
      type: 'trade_opened',
      trade: newTrade,
      profile: updatedProfile,
      trades: updatedTrades
    }));

    console.log('Trade opened successfully via WebSocket:', newTrade.id);

  } catch (error) {
    console.error('Error in handleOpenTrade:', error);
    connection.socket.send(JSON.stringify({
      type: 'trade_error',
      message: 'Failed to open trade'
    }));
  }
}

async function handleCloseTrade(connection: ClientConnection, data: any) {
  try {
    const { tradeId, closePrice } = data;

    console.log('Closing trade via WebSocket:', tradeId, 'at price:', closePrice);

    // Get trade details
    const { data: tradeData, error: fetchError } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .eq('user_id', connection.userId)
      .single();

    if (fetchError || !tradeData) {
      console.error('Error fetching trade:', fetchError);
      connection.socket.send(JSON.stringify({
        type: 'trade_error',
        message: 'Trade not found'
      }));
      return;
    }

    // Calculate P&L
    const { data: pnlResult, error: pnlError } = await supabase
      .rpc('calculate_pnl', {
        trade_type: tradeData.trade_type,
        amount: tradeData.amount,
        open_price: tradeData.open_price,
        current_price: closePrice,
        leverage_param: tradeData.leverage || 1
      });

    if (pnlError) {
      console.error('Error calculating P&L:', pnlError);
      connection.socket.send(JSON.stringify({
        type: 'trade_error',
        message: 'Failed to calculate P&L'
      }));
      return;
    }

    // Update trade to closed
    const { data: updatedTrade, error: updateError } = await supabase
      .from('trades')
      .update({
        close_price: closePrice,
        pnl: pnlResult,
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', tradeId)
      .select()
      .single();

    if (updateError) {
      console.error('Error closing trade:', updateError);
      connection.socket.send(JSON.stringify({
        type: 'trade_error',
        message: 'Failed to close trade'
      }));
      return;
    }

    // Recalculate margins immediately
    await recalculateUserMargins(connection.userId);

    // Get updated user profile and trades
    const updatedProfile = await getUserProfile(connection.userId);
    const updatedTrades = await getUserTrades(connection.userId);

    // Broadcast to user
    connection.socket.send(JSON.stringify({
      type: 'trade_closed',
      trade: updatedTrade,
      profile: updatedProfile,
      trades: updatedTrades
    }));

    console.log('Trade closed successfully via WebSocket:', tradeId, 'P&L:', pnlResult);

  } catch (error) {
    console.error('Error in handleCloseTrade:', error);
    connection.socket.send(JSON.stringify({
      type: 'trade_error',
      message: 'Failed to close trade'
    }));
  }
}

async function recalculateUserMargins(userId: string) {
  try {
    console.log('Recalculating margins for user:', userId);

    // Calculate totals
    let totalUsedMargin = 0;
    let totalClosedPnL = 0;
    const baseBalance = 10000.00;

    // Get open trades margin
    const { data: openTrades, error: openError } = await supabase
      .from('trades')
      .select('margin_used')
      .eq('user_id', userId)
      .eq('status', 'open');

    if (!openError && openTrades) {
      totalUsedMargin = openTrades.reduce((sum, trade) => sum + (trade.margin_used || 0), 0);
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
    const availableMargin = Math.max(newBalance - totalUsedMargin, 0);

    // Update user profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        balance: newBalance,
        equity: newBalance,
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
      usedMargin: totalUsedMargin,
      availableMargin
    });

    // Broadcast margin update to connected user immediately
    broadcastToUser(userId, {
      type: 'margin_update',
      data: {
        userId,
        balance: newBalance,
        usedMargin: totalUsedMargin,
        availableMargin,
        equity: newBalance
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