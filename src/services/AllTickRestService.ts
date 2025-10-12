interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
  source?: string;
}

interface CoinGeckoPriceData {
  usd: number;
  usd_24h_change?: number;
}

interface YahooQuoteResult {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
}

/**
 * Multi-Source REST Polling Service
 * - CoinGecko API for crypto prices
 * - Yahoo Finance API for forex, stocks, indices, commodities
 * Updates: ~2 second polling interval
 */
export class AllTickRestService {
  private subscribers = new Set<(update: PriceUpdate) => void>();
  private connected = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLLING_INTERVAL = 2000; // 2 seconds

  // Yahoo Finance symbol mappings (our symbol -> Yahoo symbol)
  private readonly YAHOO_SYMBOL_MAP: Record<string, string> = {
    // Forex
    'EURUSD': 'EURUSD=X',
    'GBPUSD': 'GBPUSD=X',
    'USDJPY': 'JPY=X',
    'AUDUSD': 'AUDUSD=X',
    'USDCAD': 'CAD=X',
    'USDCHF': 'CHF=X',
    'NZDUSD': 'NZDUSD=X',
    'EURGBP': 'EURGBP=X',
    'EURJPY': 'EURJPY=X',
    'GBPJPY': 'GBPJPY=X',
    // Indices
    'US500': '^GSPC',      // S&P 500
    'US30': '^DJI',        // Dow Jones
    'US100': '^IXIC',      // NASDAQ
    'GER40': '^GDAXI',     // DAX
    'UK100': '^FTSE',      // FTSE 100
    'JPN225': '^N225',     // Nikkei 225
    'FRA40': '^FCHI',      // CAC 40
    'AUS200': '^AXJO',     // ASX 200
    // Commodities
    'XAUUSD': 'GC=F',      // Gold
    'XAGUSD': 'SI=F',      // Silver
    'USOIL': 'CL=F',       // Crude Oil WTI
    'UKOIL': 'BZ=F',       // Brent Crude
    'NATGAS': 'NG=F',      // Natural Gas
    // Major Stocks (use as-is)
    'AAPL': 'AAPL',
    'MSFT': 'MSFT',
    'GOOGL': 'GOOGL',
    'AMZN': 'AMZN',
    'TSLA': 'TSLA',
    'META': 'META',
    'NVDA': 'NVDA',
    'JPM': 'JPM',
    'V': 'V',
    'JNJ': 'JNJ'
  };

  constructor() {
    console.log('🔌 Multi-Source REST Polling Service initialized');
  }

  async connect(): Promise<boolean> {
    if (this.connected && this.pollingInterval) {
      console.log('✅ Already polling price APIs');
      return true;
    }

    return this.startPolling();
  }

  private async startPolling(): Promise<boolean> {
    try {
      console.log('🔌 Starting multi-source REST API polling...');
      
      // Initial fetch
      await this.fetchAllPrices();
      
      // Start polling interval
      this.pollingInterval = setInterval(() => {
        this.fetchAllPrices();
      }, this.POLLING_INTERVAL);
      
      this.connected = true;
      console.log(`✅ Polling price APIs every ${this.POLLING_INTERVAL}ms`);
      return true;
    } catch (error) {
      console.error('❌ Failed to start polling:', error);
      return false;
    }
  }

  private async fetchAllPrices(): Promise<void> {
    await Promise.all([
      this.fetchCryptoPrices(),
      this.fetchYahooPrices()
    ]);
  }

  private async fetchCryptoPrices(): Promise<void> {
    try {
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
        console.error(`❌ CoinGecko API error: ${response.status}`);
        return;
      }
      
      const data = await response.json() as Record<string, CoinGeckoPriceData>;
      
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
      
      let updateCount = 0;
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
      console.error('❌ Error fetching crypto prices:', error);
    }
  }

  private async fetchYahooPrices(): Promise<void> {
    try {
      const yahooSymbols = Object.values(this.YAHOO_SYMBOL_MAP);
      if (yahooSymbols.length === 0) return;

      const symbolsParam = yahooSymbols.join(',');
      const response = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolsParam}&fields=regularMarketPrice,regularMarketChangePercent`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (!response.ok) {
        console.error(`❌ Yahoo Finance API error: ${response.status}`);
        return;
      }

      const data = await response.json();
      const results = data?.quoteResponse?.result as YahooQuoteResult[] || [];

      const reverseMap = Object.entries(this.YAHOO_SYMBOL_MAP).reduce((acc, [our, yahoo]) => {
        acc[yahoo] = our;
        return acc;
      }, {} as Record<string, string>);

      let updateCount = 0;
      for (const quote of results) {
        const ourSymbol = reverseMap[quote.symbol];
        if (ourSymbol && quote.regularMarketPrice) {
          const update: PriceUpdate = {
            symbol: ourSymbol,
            price: quote.regularMarketPrice,
            change_24h: quote.regularMarketChangePercent || 0,
            timestamp: Date.now(),
            source: 'Yahoo'
          };

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
        console.log(`📊 Updated ${updateCount} prices via Yahoo Finance`);
      }
    } catch (error) {
      console.error('❌ Error fetching Yahoo prices:', error);
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
   * Get the total number of symbols being monitored
   */
  public getSymbolCount(): number {
    return Object.keys(this.YAHOO_SYMBOL_MAP).length + 43; // 43 crypto from CoinGecko
  }

 
  disconnect(): void {
    console.log('🔌 Stopping price polling');
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.connected = false;
    this.subscribers.clear();
  }
}

