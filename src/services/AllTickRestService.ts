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

interface CoinGeckoPriceData {
  usd: number;
  usd_24h_change?: number;
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
      // Use CoinGecko API - has CORS enabled and no geo-blocking
      // Fetch all coins in one request
      const coinIds = [
        'bitcoin', 'ethereum', 'binancecoin', 'ripple', 'cardano', 'solana',
        'dogecoin', 'polkadot', 'polygon', 'litecoin', 'shiba-inu', 'avalanche',
        'chainlink', 'uniswap', 'cosmos', 'tron', 'near', 'internet-computer',
        'aptos', 'filecoin', 'algorand', 'the-graph', 'sandbox', 'decentraland',
        'aave', 'stellar', 'vechain', 'eos', 'tezos', 'theta-token',
        'axie-infinity', 'fantom', 'kusama', 'hedera-hashgraph', 'zcash',
        'dash', 'thorchain', 'enjincoin', 'basic-attention-token', 'yearn-finance',
        'horizen', 'illuvium', 'immutable-x'
      ];
      
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (!response.ok) {
        console.error(`❌ CoinGecko API error: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json() as Record<string, CoinGeckoPriceData>;
      let updateCount = 0;
      
      // Map CoinGecko IDs to our symbols
      const coinGeckoMap: Record<string, string> = {
        'bitcoin': 'BTCUSD', 'ethereum': 'ETHUSD', 'binancecoin': 'BNBUSD',
        'ripple': 'XRPUSD', 'cardano': 'ADAUSD', 'solana': 'SOLUSD',
        'dogecoin': 'DOGEUSD', 'polkadot': 'DOTUSD', 'polygon': 'MATICUSD',
        'litecoin': 'LTCUSD', 'shiba-inu': 'SHIBUSD', 'avalanche': 'AVAXUSD',
        'chainlink': 'LINKUSD', 'uniswap': 'UNIUSD', 'cosmos': 'ATOMUSD',
        'tron': 'TRXUSD', 'near': 'NEARUSD', 'internet-computer': 'ICPUSD',
        'aptos': 'APTUSD', 'filecoin': 'FILUSD', 'algorand': 'ALGOUSD',
        'the-graph': 'GRTUSD', 'sandbox': 'SANDUSD', 'decentraland': 'MANAUSD',
        'aave': 'AAVEUSD', 'stellar': 'XLMUSD', 'vechain': 'VETUSD',
        'eos': 'EOSUSD', 'tezos': 'XTZUSD', 'theta-token': 'THETAUSD',
        'axie-infinity': 'AXSUSD', 'fantom': 'FTMUSD', 'kusama': 'KSMUSD',
        'hedera-hashgraph': 'HBARUSD', 'zcash': 'ZECUSD', 'dash': 'DASHUSD',
        'thorchain': 'RUNEUSD', 'enjincoin': 'ENJUSD', 'basic-attention-token': 'BATUSD',
        'yearn-finance': 'YFIUSD', 'horizen': 'ZENUSDT', 'illuvium': 'ILVUSD',
        'immutable-x': 'IMXUSD'
      };
      
      // Process each coin
      for (const [coinId, priceData] of Object.entries(data)) {
        const ourSymbol = coinGeckoMap[coinId];
        if (ourSymbol && priceData?.usd) {
          const update: PriceUpdate = {
            symbol: ourSymbol,
            price: priceData.usd,
            change_24h: priceData.usd_24h_change || 0,
            timestamp: Date.now(),
            source: 'CoinGecko'
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
        console.log(`📊 Updated ${updateCount} crypto prices via CoinGecko`);
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

