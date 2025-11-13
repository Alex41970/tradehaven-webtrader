import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWELVE_DATA_API_KEY = Deno.env.get('TWELVE_DATA_API_KEY')!;

// FREE TIER MODE: Set to true for testing (12 symbols), false for Pro plan (100 symbols)
const USE_FREE_TIER = Deno.env.get('TWELVE_DATA_FREE_TIER') !== 'false';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Twelve Data symbol mapping for all 100 assets
const SYMBOL_MAPPING: Record<string, string> = {
  // Crypto (38 symbols)
  'BTCUSD': 'BTC/USD',
  'ETHUSD': 'ETH/USD',
  'BNBUSD': 'BNB/USD',
  'XRPUSD': 'XRP/USD',
  'ADAUSD': 'ADA/USD',
  'SOLUSD': 'SOL/USD',
  'DOGEUSD': 'DOGE/USD',
  'DOTUSD': 'DOT/USD',
  'MATICUSD': 'MATIC/USD',
  'LTCUSD': 'LTC/USD',
  'LINKUSD': 'LINK/USD',
  'UNIUSD': 'UNI/USD',
  'ATOMUSD': 'ATOM/USD',
  'AVAXUSD': 'AVAX/USD',
  'XLMUSD': 'XLM/USD',
  'ALGOUSD': 'ALGO/USD',
  'VETUSD': 'VET/USD',
  'ICPUSD': 'ICP/USD',
  'FILUSD': 'FIL/USD',
  'APTUSD': 'APT/USD',
  'NEARUSD': 'NEAR/USD',
  'GRTUSD': 'GRT/USD',
  'AAVEUSD': 'AAVE/USD',
  'SANDUSD': 'SAND/USD',
  'MANAUSD': 'MANA/USD',
  'THETAUSD': 'THETA/USD',
  'AXSUSD': 'AXS/USD',
  'FTMUSD': 'FTM/USD',
  'HBARUSD': 'HBAR/USD',
  'EGLDUSD': 'EGLD/USD',
  'XTZUSD': 'XTZ/USD',
  'FLOWUSD': 'FLOW/USD',
  'CHZUSD': 'CHZ/USD',
  'KSMUSD': 'KSM/USD',
  'ONEAUSD': '1INCH/USD',
  'ENJUSD': 'ENJ/USD',
  'ZILUSD': 'ZIL/USD',
  'BATUSD': 'BAT/USD',

  // Forex (30 symbols)
  'EURUSD': 'EUR/USD',
  'GBPUSD': 'GBP/USD',
  'USDJPY': 'USD/JPY',
  'USDCHF': 'USD/CHF',
  'AUDUSD': 'AUD/USD',
  'USDCAD': 'USD/CAD',
  'NZDUSD': 'NZD/USD',
  'EURGBP': 'EUR/GBP',
  'EURJPY': 'EUR/JPY',
  'GBPJPY': 'GBP/JPY',
  'EURCHF': 'EUR/CHF',
  'AUDJPY': 'AUD/JPY',
  'GBPAUD': 'GBP/AUD',
  'EURAUD': 'EUR/AUD',
  'AUDCAD': 'AUD/CAD',
  'AUDNZD': 'AUD/NZD',
  'NZDJPY': 'NZD/JPY',
  'GBPCAD': 'GBP/CAD',
  'GBPNZD': 'GBP/NZD',
  'CHFJPY': 'CHF/JPY',
  'CADCHF': 'CAD/CHF',
  'CADJPY': 'CAD/JPY',
  'EURCAD': 'EUR/CAD',
  'EURNZD': 'EUR/NZD',
  'AUDCHF': 'AUD/CHF',
  'NZDCAD': 'NZD/CAD',
  'NZDCHF': 'NZD/CHF',
  'GBPCHF': 'GBP/CHF',
  'USDZAR': 'USD/ZAR',
  'USDMXN': 'USD/MXN',

  // Stocks (20 symbols)
  'AAPL': 'AAPL',
  'GOOGL': 'GOOGL',
  'MSFT': 'MSFT',
  'AMZN': 'AMZN',
  'TSLA': 'TSLA',
  'META': 'META',
  'NVDA': 'NVDA',
  'NFLX': 'NFLX',
  'AMD': 'AMD',
  'INTC': 'INTC',
  'PYPL': 'PYPL',
  'ADBE': 'ADBE',
  'CRM': 'CRM',
  'ORCL': 'ORCL',
  'IBM': 'IBM',
  'CSCO': 'CSCO',
  'QCOM': 'QCOM',
  'TXN': 'TXN',
  'AVGO': 'AVGO',
  'COIN': 'COIN',

  // Indices (5 symbols)
  'SPX500': 'SPX',
  'NAS100': 'NDX',
  'US30': 'DJI',
  'UK100': 'FTSE',
  'GER40': 'DAX',

  // Commodities (4 symbols)
  'XAUUSD': 'XAU/USD',
  'XAGUSD': 'XAG/USD',
  'WTIUSD': 'WTI/USD',
  'BCOUSD': 'BRENT/USD',
};

// FREE TIER: Only 12 symbols for testing
const FREE_TIER_SYMBOLS = [
  'BTC/USD',    // Crypto leader
  'ETH/USD',    // Crypto #2
  'BNB/USD',    // Top exchange coin
  'XRP/USD',    // Popular altcoin
  'SOL/USD',    // Fast blockchain
  'DOGE/USD',   // Meme coin
  'EUR/USD',    // Most traded forex
  'GBP/USD',    // Major forex
  'USD/JPY',    // Major forex
  'AAPL',       // Tech giant
  'TSLA',       // Popular stock
  'NVDA',       // AI/GPU leader
];

interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

class TwelveDataWebSocketRelay {
  private ws: WebSocket | null = null;
  private realtimeChannel: any = null;
  private presenceChannel: any = null;
  private activeUsers = 0;
  private isPaused = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private batchedUpdates: Map<string, PriceUpdate> = new Map();
  private batchWriteInterval: number | null = null;
  private heartbeatInterval: number | null = null;

  async start() {
    console.log(`🚀 Starting Twelve Data WebSocket Relay - ${USE_FREE_TIER ? '[FREE TIER - 12 SYMBOLS]' : '[PRO TIER - 100 SYMBOLS]'}`);
    
    // Set up Supabase Realtime presence tracking
    await this.setupPresenceTracking();
    
    // Set up batch write interval (every 10 seconds)
    this.batchWriteInterval = setInterval(() => {
      this.writeBatchToDatabase();
    }, 10000);

    // Set up heartbeat (every 30 seconds)
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
    
    // Initial connection
    await this.connectToTwelveData();
  }

  private async setupPresenceTracking() {
    console.log('👥 Setting up presence tracking...');
    
    this.presenceChannel = supabase.channel('price-relay-presence', {
      config: {
        presence: {
          key: 'server',
        },
      },
    });

    this.presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = this.presenceChannel.presenceState();
        const clientCount = Object.keys(state).filter(key => key !== 'server').length;
        console.log(`👥 Active clients: ${clientCount}`);
        this.handlePresenceChange(clientCount);
      })
      .on('presence', { event: 'join' }, ({ key }: any) => {
        console.log(`✅ Client joined: ${key}`);
      })
      .on('presence', { event: 'leave' }, ({ key }: any) => {
        console.log(`❌ Client left: ${key}`);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Presence channel subscribed');
          // Track server presence
          await this.presenceChannel.track({ role: 'server', started_at: new Date().toISOString() });
        }
      });
  }

  private handlePresenceChange(clientCount: number) {
    const previousActiveUsers = this.activeUsers;
    this.activeUsers = clientCount;

    if (previousActiveUsers === 0 && clientCount > 0) {
      console.log('🟢 Users came online - resuming price updates');
      this.isPaused = false;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connectToTwelveData();
      }
    } else if (previousActiveUsers > 0 && clientCount === 0) {
      console.log('🔴 No users online - pausing price updates');
      this.isPaused = true;
      this.disconnectFromTwelveData();
    }
  }

  private async connectToTwelveData() {
    if (this.isPaused) {
      console.log('⏸️ System paused - not connecting');
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('⚠️ Already connected to Twelve Data');
      return;
    }

    try {
      console.log('🔌 Connecting to Twelve Data WebSocket...');
      
      const wsUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${TWELVE_DATA_API_KEY}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ Connected to Twelve Data WebSocket');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        
        // Subscribe to all symbols
        this.subscribeToAllSymbols();
      };

      this.ws.onmessage = (event) => {
        this.handleTwelveDataMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('❌ Twelve Data WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('🔌 Disconnected from Twelve Data WebSocket');
        this.ws = null;
        
        if (!this.isPaused) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('❌ Failed to connect to Twelve Data:', error);
      this.scheduleReconnect();
    }
  }

  private subscribeToAllSymbols() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ Cannot subscribe: WebSocket not open');
      return;
    }

    // Use FREE_TIER_SYMBOLS (12) or all SYMBOL_MAPPING symbols (100)
    const symbols = USE_FREE_TIER ? FREE_TIER_SYMBOLS : Object.values(SYMBOL_MAPPING);
    
    const subscribeMessage = {
      action: 'subscribe',
      params: {
        symbols: symbols.join(','),
      }
    };

    console.log(`📡 ${USE_FREE_TIER ? '[FREE TIER]' : '[PRO TIER]'} Subscribing to ${symbols.length} symbols: ${symbols.slice(0, 5).join(', ')}...`);
    this.ws.send(JSON.stringify(subscribeMessage));
  }

  private handleTwelveDataMessage(data: string) {
    try {
      const message = JSON.parse(data);
      
      // Handle different message types
      if (message.event === 'subscribe-status') {
        console.log('📊 Subscription status:', message.status);
        return;
      }

      if (message.event === 'price') {
        // Price update received
        const twelveDataSymbol = message.symbol;
        const price = parseFloat(message.price);
        
        // Find our internal symbol
        const internalSymbol = Object.entries(SYMBOL_MAPPING).find(
          ([_, tdSymbol]) => tdSymbol === twelveDataSymbol
        )?.[0];

        if (internalSymbol && !isNaN(price)) {
          const update: PriceUpdate = {
            symbol: internalSymbol,
            price: price,
            timestamp: Date.now(),
          };

          // Add to batch for database write
          this.batchedUpdates.set(internalSymbol, update);
          
          // Broadcast immediately to active users via Realtime
          this.broadcastPriceUpdate(update);
        }
      } else if (message.event === 'heartbeat') {
        console.log('💓 Heartbeat received');
      }
    } catch (error) {
      console.error('❌ Error parsing Twelve Data message:', error);
    }
  }

  private async broadcastPriceUpdate(update: PriceUpdate) {
    if (!this.realtimeChannel) {
      // Create broadcast channel if it doesn't exist
      this.realtimeChannel = supabase.channel('price-updates');
      await this.realtimeChannel.subscribe();
    }

    try {
      await this.realtimeChannel.send({
        type: 'broadcast',
        event: 'price',
        payload: {
          symbol: update.symbol,
          price: update.price,
          timestamp: update.timestamp,
          source: 'twelve_data',
        },
      });
    } catch (error) {
      console.error('❌ Failed to broadcast price update:', error);
    }
  }

  private async writeBatchToDatabase() {
    if (this.batchedUpdates.size === 0) {
      return;
    }

    const updates = Array.from(this.batchedUpdates.values());
    this.batchedUpdates.clear();

    console.log(`💾 Writing ${updates.length} price updates to database...`);

    try {
      const updatePromises = updates.map(update => 
        supabase
          .from('assets')
          .update({
            price: update.price,
            last_ws_update: new Date(update.timestamp).toISOString(),
            price_updated_at: new Date(update.timestamp).toISOString(),
            price_source: 'twelve_data',
          })
          .eq('symbol', update.symbol)
      );

      await Promise.all(updatePromises);
      console.log(`✅ Database updated successfully`);
    } catch (error) {
      console.error('❌ Failed to write to database:', error);
    }
  }

  private sendHeartbeat() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ action: 'heartbeat' }));
      } catch (error) {
        console.error('❌ Failed to send heartbeat:', error);
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.connectToTwelveData();
    }, delay);
  }

  private disconnectFromTwelveData() {
    if (this.ws) {
      console.log('🔌 Closing Twelve Data WebSocket connection');
      this.ws.close();
      this.ws = null;
    }
  }

  async stop() {
    console.log('🛑 Stopping Twelve Data WebSocket Relay...');
    
    this.disconnectFromTwelveData();
    
    if (this.batchWriteInterval) {
      clearInterval(this.batchWriteInterval);
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.realtimeChannel) {
      await this.realtimeChannel.unsubscribe();
    }
    
    if (this.presenceChannel) {
      await this.presenceChannel.unsubscribe();
    }
  }
}

// ============================================
// AUTO-START RELAY ON DEPLOYMENT
// ============================================
console.log('🔄 Edge Function booting...');

const relay = new TwelveDataWebSocketRelay();

// Start relay immediately (no HTTP trigger needed)
relay.start().catch((error) => {
  console.error('❌ Failed to start relay:', error);
});

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keep edge function alive with simple HTTP server
Deno.serve((req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ 
      status: 'running',
      mode: USE_FREE_TIER ? 'FREE_TIER' : 'PRO_TIER',
      symbols: USE_FREE_TIER ? 12 : 100,
      message: 'Twelve Data WebSocket Relay is active',
      timestamp: new Date().toISOString()
    }), 
    {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
});
