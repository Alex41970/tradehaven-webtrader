import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sanitize and normalize AllTick API key from secrets
function sanitizeAllTickKey(key: string | null): string | null {
  if (!key) return null;
  let k = key.trim().replace(/^['"]|['"]$/g, '');
  k = k.replace(/\s+/g, '').replace(/-c-app$/i, '');
  if (!/^[A-Za-z0-9]+$/.test(k)) {
    console.warn('⚠️ ALLTICK_API_KEY contains unexpected characters; using sanitized value.');
  }
  const masked = k.length > 8 ? `${k.slice(0,4)}...${k.slice(-4)}` : k;
  console.log(`🔑 Using sanitized AllTick key: ${masked}`);
  return k;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawKey = Deno.env.get('ALLTICK_API_KEY');
    const apiKey = sanitizeAllTickKey(rawKey);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ALLTICK_API_KEY not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('🧪 Testing AllTick WebSocket connection...');
    console.log('📝 API Key sanitized and ready');

    // Test Method 1: Token in URL with ?token= (correct format per AllTick official examples)
    const test1Url = `wss://quote.alltick.io/quote-b-ws-api?token=${apiKey}`;
    console.log('🔬 Test 1: Connecting with ?token= in URL (CORRECT FORMAT)...');
    
    const result1 = await testConnection(test1Url, apiKey, 'legacy-token-format');

    // Test Method 2: Token in URL with ?t= (alternate format to test)
    const test2Url = `wss://quote.alltick.io/quote-b-ws-api?t=${apiKey}`;
    console.log('🔬 Test 2: Connecting with ?t= in URL (alternate format)...');
    
    const result2 = await testConnection(test2Url, apiKey, 'short-token-in-url');

    // Test Method 3: No token in URL, send after connection
    const test3Url = 'wss://quote.alltick.io/quote-b-ws-api';
    console.log('🔬 Test 3: Connecting without token, will authenticate via message...');
    
    const result3 = await testConnection(test3Url, apiKey, 'auth-after-connect');

    const results = {
      test1_token_parameter: result1,
      test2_t_parameter: result2,
      test3_auth_message: result3,
      recommendation: result1.success ? 'Use ?token= (CORRECT per official examples)' : result2.success ? 'Use ?t=' : result3.success ? 'Use auth message' : 'All methods failed'
    };

    console.log('📊 Test Results:', JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Test failed:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function testConnection(url: string, apiKey: string, method: string): Promise<any> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      ws?.close();
      resolve({ success: false, error: 'Connection timeout after 5s', method });
    }, 5000);

    let ws: WebSocket | null = null;
    
    try {
      ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log(`✅ ${method}: Connected successfully`);
        
        // If this is the auth-after-connect method, send auth message
        if (method === 'auth-after-connect') {
          const authMessage = {
            cmd_id: 22001, // Try authentication command
            seq_id: Date.now(),
            trace: crypto.randomUUID(),
            data: {
              token: apiKey
            }
          };
          ws!.send(JSON.stringify(authMessage));
          console.log(`📤 ${method}: Sent authentication message`);
        } else {
          // For URL-based auth, try subscribing to 1 symbol as test
          const subscribeMessage = {
            cmd_id: 22002,
            seq_id: Date.now(),
            trace: crypto.randomUUID(),
            data: {
              symbol_list: [{ code: 'EURUSD', depth_level: 5 }]
            }
          };
          ws!.send(JSON.stringify(subscribeMessage));
          console.log(`📤 ${method}: Sent test subscription`);
        }
      };
      
      ws.onmessage = (event) => {
        console.log(`📨 ${method}: Received message:`, event.data);
        clearTimeout(timeout);
        ws?.close();
        
        try {
          const data = JSON.parse(event.data);
          resolve({ 
            success: true, 
            method,
            message: data,
            note: 'Connection successful and received data'
          });
        } catch {
          resolve({ 
            success: true, 
            method,
            rawMessage: event.data,
            note: 'Connection successful, received non-JSON data'
          });
        }
      };
      
      ws.onerror = (error) => {
        console.error(`❌ ${method}: Error:`, error);
        clearTimeout(timeout);
        resolve({ 
          success: false, 
          error: error.toString(),
          method 
        });
      };
      
      ws.onclose = (event) => {
        console.log(`🔌 ${method}: Closed with code ${event.code}, reason: ${event.reason}`);
        clearTimeout(timeout);
        
        if (!timeout) return; // Already resolved
        
        resolve({ 
          success: false, 
          error: `Connection closed: ${event.code} - ${event.reason || 'No reason provided'}`,
          method 
        });
      };
      
    } catch (error) {
      clearTimeout(timeout);
      console.error(`❌ ${method}: Failed to create WebSocket:`, error);
      resolve({ 
        success: false, 
        error: error.message,
        method 
      });
    }
  });
}
