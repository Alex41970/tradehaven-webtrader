const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AllTickRealtimeResponse {
  code: number;
  msg: string;
  data: {
    [symbol: string]: {
      last_px: string;
      change_px?: string;
      change_rate?: string;
      open_px?: string;
      high_px?: string;
      low_px?: string;
      volume?: string;
      pre_close_px?: string;
      timestamp?: string;
    };
  };
}

interface PriceUpdate {
  symbol: string;
  price: number;
  change_24h: number;
  timestamp: number;
}

// Symbol mapping from internal to AllTick REST format
// REST API uses compact codes (no slashes/suffixes) for Forex/Crypto/Commodities
// Stocks and Indices keep their .US/.IDX suffixes
const symbolMapping = new Map([
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
  ['BCOUSD', 'BRUSD'],
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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get API key from environment
    const apiKey = Deno.env.get('ALLTICK_API_KEY');
    if (!apiKey) {
      console.error('❌ ALLTICK_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'API key not configured',
          prices: []
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('🔄 Fetching prices from AllTick API...');

    // Get all AllTick symbols
    const allTickSymbols = Array.from(symbolMapping.values());
    
    console.log(`📦 Fetching ${allTickSymbols.length} symbols in single batch`);

    // Split symbols by API group
    const forexCryptoCommoditySymbols = allTickSymbols.filter(code => !/(\.US|\.IDX)$/.test(code));
    const stockIndexSymbols = allTickSymbols.filter(code => /(\.US|\.IDX)$/.test(code));

    // Track auth and failure states
    let hadUnauthorized = false;
    let hadFailures = 0;

    const makeRequest = async (baseUrl: string, symbols: string[]): Promise<PriceUpdate[]> => {
      if (symbols.length === 0) return [];
      const query = encodeURIComponent(JSON.stringify({
        trace: `batch_${Date.now()}`,
        data: { symbol_list: symbols.map(code => ({ code })) }
      }));
      const url = `${baseUrl}/trade-tick?token=${apiKey}&query=${query}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401) hadUnauthorized = true;
        hadFailures++;
        console.error(`❌ Request failed: ${response.status} ${response.statusText}`);
        return [];
      }

      const json: any = await response.json();
      
      // Handle ret:600 "code invalid" gracefully (symbol not available)
      if (json.ret === 600) {
        console.warn(`⚠️ Symbols not available (ret:600): ${json.msg}`);
        return [];
      }
      
      // Check for success: ret:200 indicates success in REST API
      if (json.ret !== 200 && json.code !== 0) {
        console.error(`❌ API Error: ret=${json.ret}, msg=${json.msg}`);
        return [];
      }
      
      const tickList = json?.data?.tick_list || [];
      const reverseMapping = new Map(
        Array.from(symbolMapping.entries()).map(([k, v]) => [v, k])
      );
      const updates: PriceUpdate[] = [];
      for (const tick of tickList) {
        const internalSymbol = reverseMapping.get(tick.code);
        const price = parseFloat(tick.price);
        if (internalSymbol && !isNaN(price)) {
          updates.push({
            symbol: internalSymbol,
            price,
            change_24h: 0,
            timestamp: Number(tick.tick_time) || Date.now()
          });
        }
      }
      return updates;
    };

    // Process SEQUENTIALLY (not parallel) - fetch all symbols in 2 API calls
    const allPrices: PriceUpdate[] = [];

    // First request: Forex/Crypto/Commodities
    if (forexCryptoCommoditySymbols.length > 0) {
      const prices1 = await makeRequest('https://quote.alltick.io/quote-b-api', forexCryptoCommoditySymbols);
      allPrices.push(...prices1);
      
      // Small delay between API calls to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Second request: Stocks/Indices
    if (stockIndexSymbols.length > 0) {
      const prices2 = await makeRequest('https://quote.alltick.io/quote-stock-b-api', stockIndexSymbols);
      allPrices.push(...prices2);
    }

    const prices: PriceUpdate[] = allPrices;

    console.log(`✅ Successfully fetched ${prices.length} prices`);

    // If no prices and failures occurred, surface an error
    if (prices.length === 0 && (hadUnauthorized || hadFailures > 0)) {
      const errorMsg = hadUnauthorized 
        ? 'Unauthorized from AllTick: invalid or missing API key'
        : 'Failed to retrieve prices from AllTick';
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, prices: [] }),
        { status: hadUnauthorized ? 401 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        prices,
        timestamp: Date.now()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ AllTick relay error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        prices: []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
