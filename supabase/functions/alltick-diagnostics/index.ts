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

    // Test 1: Basic REST API connectivity
    const result1 = await testRestAPI(
      'https://quote.alltick.io/realtime',
      apiKey,
      [{ code: 'BTC/USDT.CC' }],
      'Basic REST API - Single Symbol'
    );
    results.push(result1);

    // Test 2: Multiple symbols
    const result2 = await testRestAPI(
      'https://quote.alltick.io/realtime',
      apiKey,
      [
        { code: 'BTC/USDT.CC' },
        { code: 'ETH/USDT.CC' },
        { code: 'EUR/USD.FX' }
      ],
      'REST API - Multiple Symbols'
    );
    results.push(result2);

    // Test 3: Different symbol formats
    const symbolFormats = [
      [{ code: 'BTC/USDT.CC' }],       // Crypto format
      [{ code: 'EUR/USD.FX' }],        // Forex format  
      [{ code: 'XAU/USD.CM' }],        // Commodity format
      [{ code: 'AAPL.US' }],           // Stock format
    ];

    for (let i = 0; i < symbolFormats.length; i++) {
      const result = await testRestAPI(
        'https://quote.alltick.io/realtime',
        apiKey,
        symbolFormats[i],
        `Symbol Format Test ${i + 1}: ${symbolFormats[i][0].code}`
      );
      results.push(result);
    }

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
    
    const response = await fetch(`${url}?token=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trace: `diagnostics_${Date.now()}`,
        data: {
          symbol_list: symbolList
        }
      })
    });

    const responseData = await response.json();
    const latency = Date.now() - startTime;

    if (response.ok && responseData.code === 0) {
      const dataCount = responseData.data ? responseData.data.length : 0;
      return {
        test: testName,
        success: true,
        details: `Success - received ${dataCount} price updates in ${latency}ms`,
        responseData: responseData
      };
    } else {
      return {
        test: testName,
        success: false,
        details: `API Error ${responseData.code || response.status}: ${responseData.msg || response.statusText}`,
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