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

  // Symbol mapping from internal to AllTick format
  private symbolMapping = new Map([
    // Major Forex pairs
    ['EURUSD', 'EUR/USD.FX'],
    ['GBPUSD', 'GBP/USD.FX'],
    ['USDJPY', 'USD/JPY.FX'],
    ['USDCHF', 'USD/CHF.FX'],
    ['AUDUSD', 'AUD/USD.FX'],
    ['USDCAD', 'USD/CAD.FX'],
    ['NZDUSD', 'NZD/USD.FX'],
    ['EURGBP', 'EUR/GBP.FX'],
    ['EURJPY', 'EUR/JPY.FX'],
    ['GBPJPY', 'GBP/JPY.FX'],
    
    // Crypto pairs
    ['BTCUSD', 'BTC/USDT.CC'],
    ['ETHUSD', 'ETH/USDT.CC'],
    ['ADAUSD', 'ADA/USDT.CC'],
    ['DOTUSD', 'DOT/USDT.CC'],
    ['LINKUSD', 'LINK/USDT.CC'],
    ['LTCUSD', 'LTC/USDT.CC'],
    ['XRPUSD', 'XRP/USDT.CC'],
    ['SOLUSD', 'SOL/USDT.CC'],
    ['AVAXUSD', 'AVAX/USDT.CC'],
    ['MATICUSD', 'MATIC/USDT.CC'],
    
    // Commodities
    ['XAUUSD', 'XAU/USD.CM'],
    ['XAGUSD', 'XAG/USD.CM'],
    ['WTIUSD', 'WTI/USD.CM'],
    ['BRUSD', 'BRENT/USD.CM'],
    
    // Major US Stocks
    ['AAPL', 'AAPL.US'],
    ['GOOGL', 'GOOGL.US'],
    ['MSFT', 'MSFT.US'],
    ['AMZN', 'AMZN.US'],
    ['TSLA', 'TSLA.US'],
    ['NVDA', 'NVDA.US'],
    ['META', 'META.US'],
    ['NFLX', 'NFLX.US'],
    
    // Indices
    ['SPX500', 'SPX.IDX'],
    ['NAS100', 'NASDAQ.IDX'],
    ['US30', 'DJI.IDX'],
    ['GER40', 'DAX.IDX'],
    ['UK100', 'FTSE.IDX'],
    ['JPN225', 'NIKKEI.IDX'],
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