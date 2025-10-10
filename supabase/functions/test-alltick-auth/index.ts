const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ALLTICK_API_KEY');
    
    console.log('🔑 Testing AllTick authentication...');
    console.log(`API Key present: ${!!apiKey}`);
    console.log(`API Key length: ${apiKey?.length || 0}`);
    console.log(`API Key prefix: ${apiKey?.substring(0, 10) || 'N/A'}...`);

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ALLTICK_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test 1: Stock symbol
    const stockQuery = encodeURIComponent(JSON.stringify({
      trace: `auth_test_stock_${Date.now()}`,
      data: { symbol_list: [{ code: 'AAPL.US' }] }
    }));

    const stockResponse = await fetch(`https://quote.alltick.io/quote-stock-b-api/trade-tick?token=${apiKey}&query=${stockQuery}`);
    const stockData = await stockResponse.json();

    console.log(`Stock test - Status: ${stockResponse.status}, Data:`, stockData);

    // Test 2: Forex symbol (compact code)
    const forexQuery = encodeURIComponent(JSON.stringify({
      trace: `auth_test_forex_${Date.now()}`,
      data: { symbol_list: [{ code: 'EURUSD' }] }
    }));

    const forexResponse = await fetch(`https://quote.alltick.io/quote-b-api/trade-tick?token=${apiKey}&query=${forexQuery}`);
    const forexData = await forexResponse.json();

    console.log(`Forex test - Status: ${forexResponse.status}, Data:`, forexData);

    // Check success: ret:200 indicates success
    const stockSuccess = stockData.ret === 200;
    const forexSuccess = forexData.ret === 200;

    return new Response(
      JSON.stringify({
        success: stockSuccess && forexSuccess,
        tests: {
          stock: {
            success: stockSuccess,
            status: stockResponse.status,
            response: stockData
          },
          forex: {
            success: forexSuccess,
            status: forexResponse.status,
            response: forexData
          }
        },
        apiKeyInfo: {
          present: true,
          length: apiKey.length,
          prefix: apiKey.substring(0, 10)
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Test error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
