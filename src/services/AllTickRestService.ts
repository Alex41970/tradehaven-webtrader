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
    ['AUDCAD', 'AUDCAD'],
    ['AUDCHF', 'AUDCHF'],
    ['AUDJPY', 'AUDJPY'],
    ['AUDNZD', 'AUDNZD'],
    ['CADCHF', 'CADCHF'],
    ['CADJPY', 'CADJPY'],
    ['CHFJPY', 'CHFJPY'],
    ['EURAUD', 'EURAUD'],
    ['EURCAD', 'EURCAD'],
    ['EURCHF', 'EURCHF'],
    ['EURNZD', 'EURNZD'],
    ['GBPAUD', 'GBPAUD'],
    ['GBPCAD', 'GBPCAD'],
    ['GBPCHF', 'GBPCHF'],
    ['GBPNZD', 'GBPNZD'],
    ['NZDCAD', 'NZDCAD'],
    ['NZDCHF', 'NZDCHF'],
    ['NZDJPY', 'NZDJPY'],
    ['USDSEK', 'USDSEK'],
    ['USDNOK', 'USDNOK'],
    // NEW: Exotic Forex pairs
    ['USDDKK', 'USDDKK'],
    ['USDPLN', 'USDPLN'],
    ['USDHUF', 'USDHUF'],
    ['USDCZK', 'USDCZK'],
    ['USDTRY', 'USDTRY'],
    ['USDZAR', 'USDZAR'],
    ['USDMXN', 'USDMXN'],
    ['USDSGD', 'USDSGD'],
    ['USDHKD', 'USDHKD'],
    ['USDRUB', 'USDRUB'],
    ['USDINR', 'USDINR'],
    ['USDCNH', 'USDCNH'],
    ['USDKRW', 'USDKRW'],
    ['USDBRL', 'USDBRL'],
    ['USDARS', 'USDARS'],
    ['USDCLP', 'USDCLP'],
    ['USDTHB', 'USDTHB'],
    ['USDILS', 'USDILS'],
    ['EURSEK', 'EURSEK'],
    ['EURNOK', 'EURNOK'],
    ['EURDKK', 'EURDKK'],
    
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
    ['UNIUSD', 'UNIUSDT'],
    ['ATOMUSD', 'ATOMUSDT'],
    ['ALGOUSD', 'ALGOUSDT'],
    ['VETUSD', 'VETUSDT'],
    ['FTMUSD', 'FTMUSDT'],
    ['NEARUSD', 'NEARUSDT'],
    ['APTUSD', 'APTUSDT'],
    ['BNBUSD', 'BNBUSDT'],
    ['TRXUSD', 'TRXUSDT'],
    ['ICPUSD', 'ICPUSDT'],
    // NEW: Additional Crypto
    ['XMRUSD', 'XMRUSDT'],
    ['ARBUSD', 'ARBUSDT'],
    ['OPUSD', 'OPUSDT'],
    ['AAVEUSD', 'AAVEUSDT'],
    ['MKRUSD', 'MKRUSDT'],
    ['COMPUSD', 'COMPUSDT'],
    ['SNXUSD', 'SNXUSDT'],
    ['CRVUSD', 'CRVUSDT'],
    ['SUSHIUSD', 'SUSHIUSDT'],
    ['GRTUSD', 'GRTUSDT'],
    ['LDOUSD', 'LDOUSDT'],
    ['RPLUSD', 'RPLUSDT'],
    ['DOGEUSD', 'DOGEUSDT'],
    ['SHIBUSD', 'SHIBUSDT'],
    ['PEPEUSD', 'PEPEUSDT'],
    ['FLOKIUSD', 'FLOKIUSDT'],
    ['CROUPD', 'CROUSDT'],
    ['OKBUSD', 'OKBUSDT'],
    ['SANDUSD', 'SANDUSDT'],
    ['MANAUSD', 'MANAUSDT'],
    ['AXSUSD', 'AXSUSDT'],
    ['ENJUSD', 'ENJUSDT'],
    ['GALAUSD', 'GALAUSDT'],
    ['FILUSD', 'FILUSDT'],
    ['ARUSD', 'ARUSDT'],
    ['RENDERUSD', 'RENDERUSDT'],
    ['WBTCUSD', 'WBTCUSDT'],
    ['STETHUSD', 'STETHUSDT'],
    ['KSMUSD', 'KSMUSDT'],
    ['QNTUSD', 'QNTUSDT'],
    ['THETAUSD', 'THETAUSDT'],
    ['FLOWUSD', 'FLOWUSDT'],
    ['MINAUSD', 'MINAUSDT'],
    
    // Commodities (compact codes for REST)
    ['XAUUSD', 'XAUUSD'],
    ['XAGUSD', 'XAGUSD'],
    ['WTIUSD', 'WTIUSD'],
    ['BRUSD', 'BRUSD'],
    ['XPTUSD', 'XPTUSD'],
    ['XPDUSD', 'XPDUSD'],
    ['NATGAS', 'NATGAS'],
    ['COPPER', 'COPPER'],
    ['COCOA', 'COCOA'],
    ['COFFEE', 'COFFEE'],
    ['COTTON', 'COTTON'],
    ['SUGAR', 'SUGAR'],
    ['WHEAT', 'WHEAT'],
    // NEW: Additional Commodities
    ['XCUUSD', 'COPPER'],
    ['XALUSD', 'ALUMINUM'],
    ['XZNCUSD', 'ZINC'],
    ['XNIUSD', 'NICKEL'],
    ['NATGASUSD', 'NATGAS'],
    ['UKOIL', 'BRUSD'],
    ['USOIL', 'WTIUSD'],
    ['CORN', 'CORN'],
    ['SOYBEAN', 'SOYBEAN'],
    ['CATTLE', 'CATTLE'],
    ['HOGS', 'HOGS'],
    ['ORANGE', 'ORANGE'],
    ['LUMBER', 'LUMBER'],
    
    // Major US Stocks (keep .US suffix)
    ['AAPL', 'AAPL.US'],
    ['GOOGL', 'GOOGL.US'],
    ['MSFT', 'MSFT.US'],
    ['AMZN', 'AMZN.US'],
    ['TSLA', 'TSLA.US'],
    ['NVDA', 'NVDA.US'],
    ['META', 'META.US'],
    ['NFLX', 'NFLX.US'],
    ['AMD', 'AMD.US'],
    ['INTC', 'INTC.US'],
    ['JPM', 'JPM.US'],
    ['BAC', 'BAC.US'],
    ['ABBV', 'ABBV.US'],
    ['JNJ', 'JNJ.US'],
    ['HD', 'HD.US'],
    ['V', 'V.US'],
    ['MA', 'MA.US'],
    ['UNH', 'UNH.US'],
    ['LLY', 'LLY.US'],
    ['KO', 'KO.US'],
    ['PEP', 'PEP.US'],
    ['WMT', 'WMT.US'],
    ['XOM', 'XOM.US'],
    // NEW: Additional Stocks
    ['CRM', 'CRM.US'],
    ['ADBE', 'ADBE.US'],
    ['ORCL', 'ORCL.US'],
    ['CSCO', 'CSCO.US'],
    ['IBM', 'IBM.US'],
    ['QCOM', 'QCOM.US'],
    ['PYPL', 'PYPL.US'],
    ['SQ', 'SQ.US'],
    ['SHOP', 'SHOP.US'],
    ['SNAP', 'SNAP.US'],
    ['PINS', 'PINS.US'],
    ['UBER', 'UBER.US'],
    ['LYFT', 'LYFT.US'],
    ['WFC', 'WFC.US'],
    ['GS', 'GS.US'],
    ['MS', 'MS.US'],
    ['C', 'C.US'],
    ['BK', 'BK.US'],
    ['USB', 'USB.US'],
    ['PNC', 'PNC.US'],
    ['AXP', 'AXP.US'],
    ['PFE', 'PFE.US'],
    ['MRK', 'MRK.US'],
    ['TMO', 'TMO.US'],
    ['BMY', 'BMY.US'],
    ['AMGN', 'AMGN.US'],
    ['GILD', 'GILD.US'],
    ['CVS', 'CVS.US'],
    ['DIS', 'DIS.US'],
    ['NKE', 'NKE.US'],
    ['MCD', 'MCD.US'],
    ['SBUX', 'SBUX.US'],
    ['COST', 'COST.US'],
    ['TGT', 'TGT.US'],
    ['LOW', 'LOW.US'],
    ['TJX', 'TJX.US'],
    ['BKNG', 'BKNG.US'],
    ['CVX', 'CVX.US'],
    ['COP', 'COP.US'],
    ['SLB', 'SLB.US'],
    
    // Indices (keep .IDX suffix)
    ['SPX500', 'SPX500.IDX'],
    ['NAS100', 'NAS100.IDX'],
    ['US30', 'US30.IDX'],
    ['GER40', 'GER40.IDX'],
    ['UK100', 'UK100.IDX'],
    ['JPN225', 'JPN225.IDX'],
    ['AUS200', 'AUS200.IDX'],
    ['CHINA50', 'CHINA50.IDX'],
    ['HK50', 'HK50.IDX'],
    ['FRA40', 'FRA40.IDX'],
    ['EUSTX50', 'EUSTX50.IDX'],
    ['DJ30', 'DJ30.IDX'],
    // NEW: Additional Indices
    ['RUSSELL2000', 'RUSSELL2000.IDX'],
    ['STOXX50', 'STOXX50.IDX'],
    ['ESP35', 'ESP35.IDX'],
    ['INDIA50', 'INDIA50.IDX'],
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
    // Start immediately, then every 1 second (AllTick Basic plan supports high-frequency updates)
    this.fetchBatch();
    
    this.pollingInterval = setInterval(() => {
      this.fetchBatch();
    }, 1000);
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