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

    // Test 1: Different API key parameter formats
    const tokenParams = ['t', 'token', 'api_key', 'key'];
    
    for (const param of tokenParams) {
      const result = await testWebSocketConnection(
        `wss://quote.alltick.io/?${param}=${apiKey}`,
        `API Key Parameter: ?${param}=`
      );
      results.push(result);
    }

    // Test 2: Different symbol formats
    const symbolFormats = [
      ['BTCUSD.CC'],           // Current format
      ['BTCUSD'],              // Without suffix  
      ['BTC-USD'],             // With dash
      ['btcusd.cc'],           // Lowercase
      ['XBTUSD.CC'],           // Alternative BTC symbol
    ];

    for (const symbols of symbolFormats) {
      const result = await testSubscription(
        `wss://quote.alltick.io/?t=${apiKey}`,
        symbols,
        `Symbol Format: ${symbols[0]}`
      );
      results.push(result);
    }

    // Test 3: Different message structures
    const messageStructures = [
      // Current structure
      {
        cmd_id: 22000,
        seq_id: 123,
        trace: "test_trace_001",
        data: {
          symbol_list: ["BTCUSD.CC"],
          filter_list: [0]
        }
      },
      // Simplified structure
      {
        cmd_id: 22000,
        data: {
          symbol_list: ["BTCUSD.CC"]
        }
      },
      // Alternative cmd_id
      {
        cmd_id: 22001,
        data: {
          symbol_list: ["BTCUSD.CC"],
          filter_list: [0]
        }
      }
    ];

    for (let i = 0; i < messageStructures.length; i++) {
      const result = await testMessageStructure(
        `wss://quote.alltick.io/?t=${apiKey}`,
        messageStructures[i],
        `Message Structure ${i + 1}`
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

async function testWebSocketConnection(url: string, testName: string): Promise<DiagnosticResult> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        test: testName,
        success: false,
        details: 'Connection timeout after 5s'
      });
    }, 5000);

    try {
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          test: testName,
          success: true,
          details: 'WebSocket connection successful'
        });
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        resolve({
          test: testName,
          success: false,
          details: `Connection error: ${error}`
        });
      };

    } catch (error) {
      clearTimeout(timeout);
      resolve({
        test: testName,
        success: false,
        details: `Exception: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
}

async function testSubscription(url: string, symbols: string[], testName: string): Promise<DiagnosticResult> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        test: testName,
        success: false,
        details: 'No response to subscription after 8s'
      });
    }, 8000);

    try {
      const ws = new WebSocket(url);
      let responseReceived = false;
      
      ws.onopen = () => {
        const subscribeMessage = {
          cmd_id: 22000,
          seq_id: 123,
          trace: "diagnostic_test",
          data: {
            symbol_list: symbols,
            filter_list: [0]
          }
        };
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        if (!responseReceived) {
          responseReceived = true;
          clearTimeout(timeout);
          ws.close();
          
          try {
            const data = JSON.parse(event.data);
            resolve({
              test: testName,
              success: true,
              details: `Received response: ${data.event_name || 'unknown event'}`,
              responseData: data
            });
          } catch {
            resolve({
              test: testName,
              success: true,
              details: `Received non-JSON response: ${event.data.substring(0, 100)}`
            });
          }
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        resolve({
          test: testName,
          success: false,
          details: `WebSocket error: ${error}`
        });
      };

    } catch (error) {
      clearTimeout(timeout);
      resolve({
        test: testName,
        success: false,
        details: `Exception: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
}

async function testMessageStructure(url: string, message: any, testName: string): Promise<DiagnosticResult> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        test: testName,
        success: false,
        details: 'No response to message structure test after 8s'
      });
    }, 8000);

    try {
      const ws = new WebSocket(url);
      let responseReceived = false;
      
      ws.onopen = () => {
        ws.send(JSON.stringify(message));
      };

      ws.onmessage = (event) => {
        if (!responseReceived) {
          responseReceived = true;
          clearTimeout(timeout);
          ws.close();
          
          try {
            const data = JSON.parse(event.data);
            resolve({
              test: testName,
              success: true,
              details: `Response: ${data.event_name || data.cmd_id || 'success'}`,
              responseData: data
            });
          } catch {
            resolve({
              test: testName,
              success: true,
              details: `Non-JSON response received`
            });
          }
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        resolve({
          test: testName,
          success: false,
          details: `WebSocket error: ${error}`
        });
      };

    } catch (error) {
      clearTimeout(timeout);
      resolve({
        test: testName,
        success: false,
        details: `Exception: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
}