import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWELVE_DATA_API_KEY = Deno.env.get('TWELVE_DATA_API_KEY')!;
const USE_FREE_TIER = Deno.env.get('TWELVE_DATA_FREE_TIER') !== 'false';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SYMBOL_MAPPING: Record<string, string> = {
  'BTCUSD': 'BTC/USD', 'ETHUSD': 'ETH/USD', 'BNBUSD': 'BNB/USD', 'XRPUSD': 'XRP/USD',
  'ADAUSD': 'ADA/USD', 'SOLUSD': 'SOL/USD', 'DOGEUSD': 'DOGE/USD', 'DOTUSD': 'DOT/USD',
  'MATICUSD': 'MATIC/USD', 'LTCUSD': 'LTC/USD', 'LINKUSD': 'LINK/USD', 'UNIUSD': 'UNI/USD',
  'EURUSD': 'EUR/USD', 'GBPUSD': 'GBP/USD', 'USDJPY': 'USD/JPY', 'USDCHF': 'USD/CHF',
  'AAPL': 'AAPL', 'GOOGL': 'GOOGL', 'MSFT': 'MSFT', 'TSLA': 'TSLA', 'NVDA': 'NVDA',
  'XAUUSD': 'XAU/USD', 'XAGUSD': 'XAG/USD', 'WTIUSD': 'WTI/USD',
};

const FREE_TIER_SYMBOLS = ['BTC/USD', 'ETH/USD', 'BNB/USD', 'XRP/USD', 'SOL/USD', 'DOGE/USD', 
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AAPL', 'TSLA', 'NVDA'];

interface PriceUpdate { symbol: string; price: number; timestamp: number; }
type ConnectionMode = 'websocket' | 'polling' | 'offline';

class TwelveDataWebSocketRelay {
  private ws: WebSocket | null = null;
  private realtimeChannel: any = null;
  private presenceChannel: any = null;
  private activeUsers = 0;
  private isPaused = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private batchedUpdates: Map<string, PriceUpdate> = new Map();
  private pollingInterval: number | null = null;
  private connectionMode: ConnectionMode = 'offline';
  private lastError: string | null = null;
  private wsFailedPermanently = false;

  async start() {
    console.log('🚀 Starting relay...');
    await this.validateApiKey();
    await this.setupPresenceTracking();
    await this.connectToTwelveData();
  }

  private async validateApiKey() {
    try {
      const url = `https://api.twelvedata.com/price?symbol=BTC/USD&apikey=${TWELVE_DATA_API_KEY.trim()}`;
      const response = await fetch(url);
      const data = await response.json();
      console.log(data.price ? '✅ API key valid' : '❌ API key invalid');
    } catch (e) { console.error('❌ Validation error:', e); }
  }

  private async setupPresenceTracking() {
    this.presenceChannel = supabase.channel('price-relay-presence', {
      config: { presence: { key: 'server' } }
    });
    this.presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const clientCount = Object.keys(this.presenceChannel.presenceState()).filter(k => k !== 'server').length;
        console.log(`👥 Active: ${clientCount}`);
        this.handlePresenceChange(clientCount);
      })
      .subscribe();
  }

  private handlePresenceChange(clientCount: number) {
    const wasActive = this.activeUsers > 0;
    this.activeUsers = clientCount;
    
    if (!wasActive && clientCount > 0) {
      this.isPaused = false;
      if (!this.wsFailedPermanently) this.connectToTwelveData();
      else this.startRestPolling();
    } else if (wasActive && clientCount === 0) {
      this.isPaused = true;
      this.disconnectFromTwelveData();
      this.stopRestPolling();
    }
  }

  private async connectToTwelveData() {
    if (this.isPaused || this.wsFailedPermanently) return;
    
    try {
      const wsUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${TWELVE_DATA_API_KEY.trim()}`;
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.connectionMode = 'websocket';
        this.reconnectAttempts = 0;
        this.broadcastConnectionMode();
        
        const symbols = USE_FREE_TIER ? FREE_TIER_SYMBOLS : Object.values(SYMBOL_MAPPING);
        this.ws!.send(JSON.stringify({ action: 'subscribe', params: { symbols: symbols.join(',') }}));
      };
      
      this.ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.event === 'price') {
          const internal = Object.entries(SYMBOL_MAPPING).find(([_, td]) => td === msg.symbol)?.[0];
          if (internal) this.broadcastPriceUpdate({ symbol: internal, price: parseFloat(msg.price), timestamp: Date.now() });
        }
      };
      
      this.ws.onclose = () => {
        console.log('🔌 WebSocket closed');
        this.ws = null;
        this.connectionMode = 'offline';
        if (!this.isPaused) this.scheduleReconnect();
      };
    } catch (e) { this.scheduleReconnect(); }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnects - switching to polling');
      this.wsFailedPermanently = true;
      this.startRestPolling();
      return;
    }
    this.reconnectAttempts++;
    setTimeout(() => this.connectToTwelveData(), 2000);
  }

  private async startRestPolling() {
    if (this.pollingInterval) return;
    console.log('🔄 Starting REST polling...');
    this.connectionMode = 'polling';
    this.broadcastConnectionMode();
    
    this.pollingInterval = setInterval(async () => {
      if (this.isPaused) return;
      const symbols = USE_FREE_TIER ? FREE_TIER_SYMBOLS : Object.values(SYMBOL_MAPPING);
      try {
        const url = `https://api.twelvedata.com/price?symbol=${symbols.join(',')}&apikey=${TWELVE_DATA_API_KEY.trim()}`;
        const data = await (await fetch(url)).json();
        const prices = Array.isArray(data) ? data : [data];
        
        for (const item of prices) {
          const internal = Object.entries(SYMBOL_MAPPING).find(([_, td]) => td === item.symbol)?.[0];
          if (internal) await this.broadcastPriceUpdate({ symbol: internal, price: parseFloat(item.price), timestamp: Date.now() });
        }
      } catch (e) { console.error('Polling error:', e); }
    }, 15000);
  }

  private stopRestPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async broadcastPriceUpdate(update: PriceUpdate) {
    if (!this.realtimeChannel) {
      this.realtimeChannel = supabase.channel('price-updates');
      await this.realtimeChannel.subscribe();
    }
    await this.realtimeChannel.send({
      type: 'broadcast', event: 'price',
      payload: { ...update, source: 'twelve_data', mode: this.connectionMode }
    });
  }

  private async broadcastConnectionMode() {
    if (!this.realtimeChannel) {
      this.realtimeChannel = supabase.channel('price-updates');
      await this.realtimeChannel.subscribe();
    }
    await this.realtimeChannel.send({
      type: 'broadcast', event: 'connection_mode',
      payload: { mode: this.connectionMode, timestamp: Date.now() }
    });
  }

  private disconnectFromTwelveData() {
    if (this.ws) { this.ws.close(); this.ws = null; }
  }

  getStatus() {
    return { mode: this.connectionMode, activeUsers: this.activeUsers, isPaused: this.isPaused,
      wsFailedPermanently: this.wsFailedPermanently, lastError: this.lastError };
  }
}

const relay = new TwelveDataWebSocketRelay();
relay.start();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ status: 'running', ...relay.getStatus() }), 
    { headers: { 'Content-Type': 'application/json', ...corsHeaders }});
});
