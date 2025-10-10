import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DiagnosticResult {
  test: string;
  success: boolean;
  details: string;
  responseData?: any;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ALLTICK_API_KEY');
    if (!apiKey) {
      throw new Error('ALLTICK_API_KEY not configured');
    }

    const results: DiagnosticResult[] = [];

    // Test 1: Crypto (compact code)
    const result1 = await testRestAPI(
      'https://quote.alltick.io/quote-b-api/trade-tick',
      apiKey,
      [{ code: 'BTCUSDT' }],
      'Crypto - BTCUSDT'
    );
    results.push(result1);
    await delay(1200); // Avoid rate limits

    // Test 2: Forex (compact code)
    const result2 = await testRestAPI(
      'https://quote.alltick.io/quote-b-api/trade-tick',
      apiKey,
      [{ code: 'EURUSD' }],
      'Forex - EURUSD'
    );
    results.push(result2);
    await delay(1200);

    // Test 3: Commodity (compact code)
    const result3 = await testRestAPI(
      'https://quote.alltick.io/quote-b-api/trade-tick',
      apiKey,
      [{ code: 'XAUUSD' }],
      'Commodity - XAUUSD'
    );
    results.push(result3);
    await delay(1200);

    // Test 4: Stock (standard format)
    const result4 = await testRestAPI(
      'https://quote.alltick.io/quote-stock-b-api/trade-tick',
      apiKey,
      [{ code: 'AAPL.US' }],
      'Stock - AAPL.US'
    );
    results.push(result4);
    await delay(1200);

    // Test 5: Multiple symbols from different classes
    const result5 = await testRestAPI(
      'https://quote.alltick.io/quote-b-api/trade-tick',
      apiKey,
      [
        { code: 'BTCUSDT' },
        { code: 'ETHUSDT' },
        { code: 'EURUSD' }
      ],
      'Multiple Symbols - Crypto & Forex'
    );
    results.push(result5);

    return new Response(JSON.stringify({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AllTick diagnostics error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function testRestAPI(url: string, apiKey: string, symbolList: Array<{code: string}>, testName: string): Promise<DiagnosticResult> {
  try {
    const startTime = Date.now();
    
    // Build query object
    const queryObj = {
      trace: `diagnostics_${Date.now()}`,
      data: {
        symbol_list: symbolList
      }
    };
    
    // Encode query as URL parameter
    const query = encodeURIComponent(JSON.stringify(queryObj));
    
    // Use GET with token and query in URL
    const fullUrl = `${url}?token=${apiKey}&query=${query}`;
    
    const response = await fetch(fullUrl, {
      method: 'GET'
    });

    const responseData = await response.json();
    const latency = Date.now() - startTime;

    // AllTick REST uses ret:200 for success (not code:0)
    const isSuccess = responseData.ret === 200 || responseData.code === 0;
    
    if (isSuccess) {
      const dataCount = responseData.data?.tick_list?.length || 0;
      return {
        test: testName,
        success: true,
        details: `Success - received ${dataCount} price updates in ${latency}ms`,
        responseData: responseData
      };
    } else if (responseData.ret === 600) {
      // Handle "code invalid" gracefully
      return {
        test: testName,
        success: false,
        details: `Symbol not available (ret:600): ${responseData.msg}`,
        responseData: responseData
      };
    } else if (response.status === 429) {
      return {
        test: testName,
        success: false,
        details: `Rate limit exceeded (429) - please wait before retrying`,
        responseData: responseData
      };
    } else {
      return {
        test: testName,
        success: false,
        details: `API Error ${responseData.ret || responseData.code || response.status}: ${responseData.msg || response.statusText}`,
        responseData: responseData
      };
    }
    
  } catch (error) {
    return {
      test: testName,
      success: false,
      details: `Request failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Helper to add delay between requests
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}