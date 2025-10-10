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

    // Test with a single crypto symbol
    const testResponse = await fetch(`https://quote.alltick.io/realtime?token=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trace: `auth_test_${Date.now()}`,
        data: {
          symbol_list: [{ code: 'BTC/USDT.CC' }]
        }
      })
    });

    const responseText = await testResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log(`Response status: ${testResponse.status}`);
    console.log(`Response data:`, responseData);

    return new Response(
      JSON.stringify({
        success: testResponse.ok,
        status: testResponse.status,
        statusText: testResponse.statusText,
        headers: Object.fromEntries(testResponse.headers.entries()),
        response: responseData,
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
