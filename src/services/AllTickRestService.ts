interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
  source: string;
}

interface AllTickRestResponse {
  code: number;
  msg: string;
  data: Array<{
    symbol: string;
    last_px: string;
    change_px: string;
    change_rate: string;
    timestamp: string;
  }>;
}

export class AllTickRestService {
  private subscribers = new Set<(update: PriceUpdate) => void>();
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private edgeFunctionUrl = 'https://stdfkfutgkmnaajixguz.supabase.co/functions/v1/alltick-relay';

  // Symbol mapping from internal to AllTick REST format
  // REST API uses compact codes (no slashes/suffixes) for Forex/Crypto/Commodities
  // Stocks and Indices keep their .US/.IDX suffixes
  private symbolMapping = new Map([
    // Major Forex pairs (compact codes for REST)
    ['EURUSD', 'EURUSD'],
    ['GBPUSD', 'GBPUSD'],
    ['USDJPY', 'USDJPY'],
    ['USDCHF', 'USDCHF'],
    ['AUDUSD', 'AUDUSD'],
    ['USDCAD', 'USDCAD'],
    ['NZDUSD', 'NZDUSD'],
    ['EURGBP', 'EURGBP'],
    ['EURJPY', 'EURJPY'],
    ['GBPJPY', 'GBPJPY'],
    
    // Crypto pairs (compact codes for REST)
    ['BTCUSD', 'BTCUSDT'],
    ['ETHUSD', 'ETHUSDT'],
    ['ADAUSD', 'ADAUSDT'],
    ['DOTUSD', 'DOTUSDT'],
    ['LINKUSD', 'LINKUSDT'],
    ['LTCUSD', 'LTCUSDT'],
    ['XRPUSD', 'XRPUSDT'],
    ['SOLUSD', 'SOLUSDT'],
    ['AVAXUSD', 'AVAXUSDT'],
    ['MATICUSD', 'MATICUSDT'],
    
    // Commodities (compact codes for REST)
    ['XAUUSD', 'XAUUSD'],
    ['XAGUSD', 'XAGUSD'],
    ['WTIUSD', 'WTIUSD'],
    ['BRUSD', 'BRUSD'],
    
    // Major US Stocks (keep .US suffix)
    ['AAPL', 'AAPL.US'],
    ['GOOGL', 'GOOGL.US'],
    ['MSFT', 'MSFT.US'],
    ['AMZN', 'AMZN.US'],
    ['TSLA', 'TSLA.US'],
    ['NVDA', 'NVDA.US'],
    ['META', 'META.US'],
    ['NFLX', 'NFLX.US'],
    
    // Indices (keep .IDX suffix)
    ['SPX500', 'SPX500.IDX'],
    ['NAS100', 'NAS100.IDX'],
    ['US30', 'US30.IDX'],
    ['GER40', 'GER40.IDX'],
    ['UK100', 'UK100.IDX'],
    ['JPN225', 'JPN225.IDX'],
  ]);

  constructor() {
    console.log(`🔧 AllTick REST Service initialized via Supabase relay`);
  }

  async connect(): Promise<boolean> {
    if (this.isPolling) {
      console.log('⚠️ Already polling, skipping connect');
      return true;
    }

    console.log('🚀 Starting AllTick REST API polling...');
    this.isPolling = true;
    this.startPolling();
    return true;
  }

  private startPolling(): void {
    // Start immediately, then every 12 seconds (respects AllTick free plan rate limit: 1 req/10s)
    this.fetchBatch();
    
    this.pollingInterval = setInterval(() => {
      this.fetchBatch();
    }, 12000);
  }

  private async fetchBatch(): Promise<void> {
    try {
      console.log('🔄 Fetching prices via AllTick relay...');
      
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success || !result.prices || !Array.isArray(result.prices)) {
        console.error('Invalid response from AllTick relay:', result);
        return;
      }

      console.log(`✅ Received ${result.prices.length} price updates`);
      
      // Process each price update
      result.prices.forEach((priceData: any) => {
        if (priceData && priceData.symbol) {
          const update: PriceUpdate = {
            symbol: priceData.symbol,
            price: priceData.price,
            change_24h: priceData.change_24h || 0,
            timestamp: priceData.timestamp || Date.now(),
            source: 'AllTick'
          };
          
          this.subscribers.forEach(callback => {
            try {
              callback(update);
            } catch (error) {
              console.error('Error in price update callback:', error);
            }
          });
        }
      });
      
    } catch (error) {
      console.error('❌ Error fetching prices from AllTick relay:', error);
    }
  }


  subscribeToPrices(callback: (update: PriceUpdate) => void): () => void {
    this.subscribers.add(callback);
    console.log(`📝 Added price subscriber. Total: ${this.subscribers.size}`);
    
    return () => {
      this.subscribers.delete(callback);
      console.log(`📝 Removed price subscriber. Total: ${this.subscribers.size}`);
    };
  }

  isConnected(): boolean {
    return this.isPolling;
  }

  getSymbolCount(): number {
    return this.symbolMapping.size;
  }

  disconnect(): void {
    console.log('🔌 Disconnecting AllTick REST service...');
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.isPolling = false;
    this.subscribers.clear();
  }
}