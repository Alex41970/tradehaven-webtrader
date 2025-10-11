interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
  source?: string;
}

interface WebSocketMessage {
  type: string;
  prices?: PriceUpdate[];
  timestamp?: number;
  stats?: {
    requested: number;
    received: number;
    successRate: string;
  };
  cached?: boolean;
  message?: string;
  clientCount?: number;
}

/**
 * Binance REST Polling Service - Fetches crypto prices every 2 seconds
 * Uses Binance public REST API (no WebSocket due to geo-blocking)
 * FREE unlimited data from browser (bypasses server IP blocks)
 * Updates: ~2 second polling interval
 */
export class AllTickRestService {
  private subscribers = new Set<(update: PriceUpdate) => void>();
  private connected = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLLING_INTERVAL = 2000; // 2 seconds

  // Symbol maps (our symbol -> binance stream symbol)
  private readonly SYMBOL_MAP: Record<string, string> = {
    'BTCUSD': 'btcusdt',
    'ETHUSD': 'ethusdt',
    'BNBUSD': 'bnbusdt',
    'XRPUSD': 'xrpusdt',
    'ADAUSD': 'adausdt',
    'SOLUSD': 'solusdt',
    'DOGEUSD': 'dogeusdt',
    'DOTUSD': 'dotusdt',
    'MATICUSD': 'maticusdt',
    'LTCUSD': 'ltcusdt',
    'SHIBUSD': 'shibusdt',
    'AVAXUSD': 'avaxusdt',
    'LINKUSD': 'linkusdt',
    'UNIUSD': 'uniusdt',
    'ATOMUSD': 'atomusdt',
    'TRXUSD': 'trxusdt',
    'NEARUSD': 'nearusdt',
    'ICPUSD': 'icpusdt',
    'APTUSD': 'aptusdt',
    'FILUSD': 'filusdt',
    'ALGOUSD': 'algousdt',
    'GRTUSD': 'grtusdt',
    'SANDUSD': 'sandusdt',
    'MANAUSD': 'manausdt',
    'AAVEUSD': 'aaveusdt',
    'XLMUSD': 'xlmusdt',
    'VETUSD': 'vetusdt',
    'EOSUSD': 'eosusdt',
    'XTZUSD': 'xtzusdt',
    'THETAUSD': 'thetausdt',
    'AXSUSD': 'axsusdt',
    'FTMUSD': 'ftmusdt',
    'KSMUSD': 'ksmusdt',
    'HBARUSD': 'hbarusdt',
    'ZECUSD': 'zecusdt',
    'DASHUSD': 'dashusdt',
    'RUNEUSD': 'runeusdt',
    'ENJUSD': 'enjusdt',
    'BATUSD': 'batusdt',
    'YFIUSD': 'yfiusdt',
    'ZENUSDT': 'zenusdt',
    'ILVUSD': 'ilvusdt',
    'IMXUSD': 'imxusdt'
  };
  private readonly REVERSE_SYMBOL_MAP: Record<string, string> =
    Object.entries(this.SYMBOL_MAP).reduce((acc, [k, v]) => {
      acc[v.toUpperCase()] = k;
      return acc;
    }, {} as Record<string, string>);

  constructor() {
    console.log('🔌 Binance REST Polling Service initialized');
  }

  async connect(): Promise<boolean> {
    if (this.connected && this.pollingInterval) {
      console.log('✅ Already polling Binance REST API');
      return true;
    }

    return this.startPolling();
  }

  private async startPolling(): Promise<boolean> {
    try {
      console.log('🔌 Starting Binance REST API polling (browser-based)...');
      
      // Initial fetch
      await this.fetchPrices();
      
      // Start polling interval
      this.pollingInterval = setInterval(() => {
        this.fetchPrices();
      }, this.POLLING_INTERVAL);
      
      this.connected = true;
      console.log(`✅ Polling Binance REST API every ${this.POLLING_INTERVAL}ms`);
      return true;
    } catch (error) {
      console.error('❌ Failed to start polling:', error);
      return false;
    }
  }

  private async fetchPrices(): Promise<void> {
    try {
      // Fetch all 24hr ticker data in one call
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      
      if (!response.ok) {
        console.error(`❌ Binance API error: ${response.status} ${response.statusText}`);
        return;
      }
      
      const allTickers = await response.json();
      const binanceSymbols = Object.values(this.SYMBOL_MAP);
      let updateCount = 0;
      
      // Process only our tracked symbols
      for (const ticker of allTickers) {
        const binanceSymbol = ticker.symbol.toLowerCase();
        const ourSymbol = this.REVERSE_SYMBOL_MAP[ticker.symbol];
        
        if (ourSymbol && binanceSymbols.includes(binanceSymbol)) {
          const price = parseFloat(ticker.lastPrice);
          const change = parseFloat(ticker.priceChangePercent);
          
          const update: PriceUpdate = {
            symbol: ourSymbol,
            price: price,
            change_24h: change,
            timestamp: Date.now(),
            source: 'Binance REST'
          };
          
          // Broadcast to all subscribers
          this.subscribers.forEach(callback => {
            try {
              callback(update);
            } catch (error) {
              console.error('Error in price update callback:', error);
            }
          });
          
          updateCount++;
        }
      }
      
      if (updateCount > 0) {
        console.log(`📊 Updated ${updateCount} crypto prices via REST API`);
      }
      
    } catch (error) {
      console.error('❌ Error fetching prices:', error);
    }
  }


  subscribeToPrices(callback: (update: PriceUpdate) => void): () => void {
    this.subscribers.add(callback);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  isConnected(): boolean {
    return this.connected && this.pollingInterval !== null;
  }

  /**
   * Get the number of symbols being monitored (crypto only)
   */
  public getSymbolCount(): number {
    return Object.keys(this.SYMBOL_MAP).length;
  }

 
  disconnect(): void {
    console.log('🔌 Stopping Binance REST polling');
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.connected = false;
    this.subscribers.clear();
  }
}

