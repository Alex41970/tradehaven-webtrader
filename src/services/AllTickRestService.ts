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
  private apiKey: string;
  private baseUrl = 'https://quote.alltick.io';
  private subscribers = new Set<(update: PriceUpdate) => void>();
  private pollingInterval: NodeJS.Timeout | null = null;
  private currentBatchIndex = 0;
  private isPolling = false;

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

  private allSymbols: string[];
  private batchSize = 25; // Batch size to respect rate limits

  constructor() {
    const apiKey = import.meta.env.VITE_ALLTICK_CLIENT_KEY;
    if (!apiKey || apiKey === 'your-c-app-key-here') {
      throw new Error('AllTick API key not configured');
    }
    this.apiKey = apiKey;
    this.allSymbols = Array.from(this.symbolMapping.values());
    console.log(`🔧 AllTick REST Service initialized with ${this.allSymbols.length} symbols`);
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
    // Start immediately, then every 1 second
    this.fetchBatch();
    
    this.pollingInterval = setInterval(() => {
      this.fetchBatch();
    }, 1000);
  }

  private async fetchBatch(): Promise<void> {
    try {
      // Calculate which batch of symbols to fetch
      const totalBatches = Math.ceil(this.allSymbols.length / this.batchSize);
      const startIndex = this.currentBatchIndex * this.batchSize;
      const endIndex = Math.min(startIndex + this.batchSize, this.allSymbols.length);
      const symbolBatch = this.allSymbols.slice(startIndex, endIndex);

      console.log(`📊 Fetching batch ${this.currentBatchIndex + 1}/${totalBatches}: ${symbolBatch.length} symbols`);

      // Prefer CORS-friendly GET endpoint to avoid preflight issues
      const queryPayload = {
        trace: `batch_${this.currentBatchIndex}_${Date.now()}`,
        data: {
          symbol_list: symbolBatch.map(symbol => ({ code: symbol }))
        }
      };

      let data: AllTickRestResponse;

      try {
        const url = `${this.baseUrl}/quote-b-api/trade-tick?token=${encodeURIComponent(this.apiKey)}&query=${encodeURIComponent(JSON.stringify(queryPayload))}`;
        const response = await fetch(url, { method: 'GET' });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();

        if (json && typeof json === 'object' && 'code' in json && Array.isArray((json as any).data)) {
          data = json as AllTickRestResponse;
        } else if (json && typeof json === 'object' && 'ret' in json && (json as any).ret === 200 && (json as any).data?.tick_list) {
          // Normalize trade-tick response to AllTickRestResponse shape
          data = {
            code: 0,
            msg: (json as any).msg ?? 'ok',
            data: ((json as any).data.tick_list as any[]).map((t: any) => ({
              symbol: t.code,
              last_px: t.price,
              change_px: '0',
              change_rate: '0',
              timestamp: String(t.tick_time ?? Date.now())
            }))
          };
        } else {
          throw new Error('Unexpected API response');
        }
      } catch (e) {
        // Fallback to POST /realtime (may be blocked by CORS)
        const response = await fetch(`${this.baseUrl}/realtime`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': this.apiKey
          },
          body: JSON.stringify(queryPayload)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        data = await response.json() as AllTickRestResponse;
      }

      if (data.code !== 0) {
        throw new Error(`AllTick API Error ${data.code}: ${data.msg}`);
      }

      // Process the price updates
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach(item => this.processPriceUpdate(item));
      }

      // Move to next batch (with wraparound)
      this.currentBatchIndex = (this.currentBatchIndex + 1) % totalBatches;

    } catch (error) {
      console.error('❌ AllTick REST API error:', error);
    }
  }

  private processPriceUpdate(item: any): void {
    try {
      // Find internal symbol name
      const internalSymbol = Array.from(this.symbolMapping.entries())
        .find(([, allTickSymbol]) => allTickSymbol === item.symbol)?.[0];

      if (!internalSymbol) {
        return; // Skip unknown symbols
      }

      const price = parseFloat(item.last_px);
      const changeRate = parseFloat(item.change_rate || '0');
      const timestamp = parseInt(item.timestamp) || Date.now();

      if (isNaN(price)) {
        return; // Skip invalid prices
      }

      const priceUpdate: PriceUpdate = {
        symbol: internalSymbol,
        price: price,
        change_24h: changeRate,
        timestamp: timestamp,
        source: 'AllTick-REST'
      };

      console.log(`⚡ REST PRICE: ${internalSymbol} = $${price} (${changeRate.toFixed(2)}%)`);

      // Notify all subscribers
      this.subscribers.forEach(callback => {
        try {
          callback(priceUpdate);
        } catch (error) {
          console.error('Error in price update callback:', error);
        }
      });

    } catch (error) {
      console.error('Error processing price update:', error, item);
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
    return this.allSymbols.length;
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