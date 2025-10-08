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

// Symbol mapping from internal to AllTick format
const symbolMapping = new Map([
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
    
    // Batch symbols into chunks of 50 (AllTick limit)
    const batchSize = 50;
    const batches: string[][] = [];
    for (let i = 0; i < allTickSymbols.length; i += batchSize) {
      batches.push(allTickSymbols.slice(i, i + batchSize));
    }

    console.log(`📦 Processing ${batches.length} batches of symbols`);

    // Fetch all batches in parallel
    const batchPromises = batches.map(async (batch) => {
      const response = await fetch('https://quote.alltick.io/realtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': apiKey,
        },
        body: JSON.stringify({
          trace: `batch_${Date.now()}`,
          data: {
            symbol_list: batch.map(code => ({ code }))
          }
        })
      });

      if (!response.ok) {
        console.error(`❌ Batch request failed: ${response.status} ${response.statusText}`);
        return null;
      }

      return await response.json() as AllTickRealtimeResponse;
    });

    const batchResults = await Promise.all(batchPromises);

    // Process all results and normalize
    const prices: PriceUpdate[] = [];
    const reverseMapping = new Map(
      Array.from(symbolMapping.entries()).map(([k, v]) => [v, k])
    );

    for (const result of batchResults) {
      if (!result || result.code !== 0 || !result.data) {
        continue;
      }

      // Process each symbol in the response
      for (const [allTickSymbol, priceData] of Object.entries(result.data)) {
        const internalSymbol = reverseMapping.get(allTickSymbol);
        if (!internalSymbol) continue;

        const lastPrice = parseFloat(priceData.last_px);
        const changeRate = priceData.change_rate 
          ? parseFloat(priceData.change_rate)
          : 0;

        if (!isNaN(lastPrice)) {
          prices.push({
            symbol: internalSymbol,
            price: lastPrice,
            change_24h: changeRate,
            timestamp: Date.now()
          });
        }
      }
    }

    console.log(`✅ Successfully fetched ${prices.length} prices`);

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
