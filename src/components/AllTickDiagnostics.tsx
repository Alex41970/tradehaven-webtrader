import { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';

export const AllTickDiagnostics = () => {
  const [results, setResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  const apiKey = import.meta.env.VITE_ALLTICK_CLIENT_KEY;

  const addResult = (test: string, success: boolean, details: any) => {
    setResults(prev => [...prev, { test, success, details, timestamp: Date.now() }]);
  };

  const runDiagnostics = async () => {
    setTesting(true);
    setResults([]);

    // Test 1: Basic GET request to base URL
    try {
      console.log('Test 1: GET base URL');
      const response = await fetch('https://quote.alltick.io', {
        method: 'GET',
        headers: { 'token': apiKey }
      });
      addResult('GET base URL', response.ok, { 
        status: response.status, 
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
    } catch (error: any) {
      addResult('GET base URL', false, { error: error.message });
    }

    // Test 2: POST to /realtime with minimal data
    try {
      console.log('Test 2: POST /realtime (current approach)');
      const response = await fetch('https://quote.alltick.io/realtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': apiKey
        },
        body: JSON.stringify({
          trace: 'test_' + Date.now(),
          data: {
            symbol_list: [{ code: 'BTC/USDT.CC' }]
          }
        })
      });
      const data = await response.json();
      addResult('POST /realtime', response.ok, { status: response.status, data });
    } catch (error: any) {
      addResult('POST /realtime', false, { error: error.message });
    }

    // Test 3: Try without Content-Type header
    try {
      console.log('Test 3: POST /realtime (no Content-Type)');
      const response = await fetch('https://quote.alltick.io/realtime', {
        method: 'POST',
        headers: {
          'token': apiKey
        },
        body: JSON.stringify({
          trace: 'test_' + Date.now(),
          data: {
            symbol_list: [{ code: 'BTC/USDT.CC' }]
          }
        })
      });
      const data = await response.json();
      addResult('POST /realtime (no Content-Type)', response.ok, { status: response.status, data });
    } catch (error: any) {
      addResult('POST /realtime (no Content-Type)', false, { error: error.message });
    }

    // Test 4: Try with mode: 'cors'
    try {
      console.log('Test 4: POST /realtime (explicit CORS)');
      const response = await fetch('https://quote.alltick.io/realtime', {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'token': apiKey
        },
        body: JSON.stringify({
          trace: 'test_' + Date.now(),
          data: {
            symbol_list: [{ code: 'BTC/USDT.CC' }]
          }
        })
      });
      const data = await response.json();
      addResult('POST /realtime (explicit CORS)', response.ok, { status: response.status, data });
    } catch (error: any) {
      addResult('POST /realtime (explicit CORS)', false, { error: error.message });
    }

    // Test 5: Try GET to /realtime
    try {
      console.log('Test 5: GET /realtime');
      const response = await fetch('https://quote.alltick.io/realtime?symbol=BTC/USDT.CC', {
        method: 'GET',
        headers: {
          'token': apiKey
        }
      });
      const data = await response.json();
      addResult('GET /realtime', response.ok, { status: response.status, data });
    } catch (error: any) {
      addResult('GET /realtime', false, { error: error.message });
    }

    // Test 6: Try /quote endpoint
    try {
      console.log('Test 6: POST /quote');
      const response = await fetch('https://quote.alltick.io/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': apiKey
        },
        body: JSON.stringify({
          trace: 'test_' + Date.now(),
          data: {
            symbol_list: [{ code: 'BTC/USDT.CC' }]
          }
        })
      });
      const data = await response.json();
      addResult('POST /quote', response.ok, { status: response.status, data });
    } catch (error: any) {
      addResult('POST /quote', false, { error: error.message });
    }

    // Test 7: Check API docs endpoint
    try {
      console.log('Test 7: GET /api/v1');
      const response = await fetch('https://quote.alltick.io/api/v1', {
        method: 'GET',
        headers: {
          'token': apiKey
        }
      });
      addResult('GET /api/v1', response.ok, { status: response.status });
    } catch (error: any) {
      addResult('GET /api/v1', false, { error: error.message });
    }

    setTesting(false);
  };

  const generateSupportReport = () => {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    const report = `
=================================================
ALLTICK API SUPPORT REQUEST - CORS/Connectivity Issue
=================================================

ISSUE SUMMARY:
-------------
All API requests to quote.alltick.io are failing with "Failed to fetch" errors.
This appears to be a CORS (Cross-Origin Resource Sharing) blocking issue.

ENVIRONMENT:
-----------
Domain: ac0ac84a-cb35-4876-85b6-c05832115c63.lovableproject.com
Browser: ${navigator.userAgent}
Date: ${new Date().toISOString()}

API CREDENTIALS:
---------------
API Key Type: c-app (Client Application)
API Key (partial): ${apiKey?.substring(0, 20)}...${apiKey?.substring(apiKey.length - 6)}
Expected Use: Frontend/Browser Direct Calls

DIAGNOSTIC TEST RESULTS:
-----------------------
Total Tests: ${results.length}
Successful: ${successCount}
Failed: ${failureCount}

${results.map((result, idx) => `
TEST ${idx + 1}: ${result.test}
Status: ${result.success ? '✅ PASS' : '❌ FAIL'}
Details:
${JSON.stringify(result.details, null, 2)}
---
`).join('\n')}

NETWORK ERROR DETAILS:
---------------------
Error Type: Failed to fetch
This typically indicates:
1. CORS preflight request blocked
2. Domain not whitelisted for c-app key
3. Invalid CORS headers on server

EXPECTED CORS HEADERS NEEDED:
----------------------------
Access-Control-Allow-Origin: https://ac0ac84a-cb35-4876-85b6-c05832115c63.lovableproject.com
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, token
Access-Control-Allow-Credentials: true

REQUESTS ATTEMPTED:
------------------
1. GET https://quote.alltick.io
   - Headers: token: ${apiKey?.substring(0, 15)}...
   
2. POST https://quote.alltick.io/realtime
   - Headers: Content-Type: application/json, token: [api-key]
   - Body: {"trace":"...", "data":{"symbol_list":[{"code":"BTC/USDT.CC"}]}}
   
3. GET https://quote.alltick.io/realtime?symbol=BTC/USDT.CC
   - Headers: token: [api-key]
   
4. POST https://quote.alltick.io/quote
   - Headers: Content-Type: application/json, token: [api-key]

QUESTION FOR SUPPORT:
--------------------
Our c-app API key should work from browser/frontend, correct?
Do we need to whitelist our domain? If so, where in the dashboard?
We see no whitelist settings in our AllTick account.

Are there any CORS configuration steps we're missing?

CONTACT INFO:
------------
Please respond with:
1. Confirmation that our domain is whitelisted
2. Any required CORS configuration steps
3. Alternative endpoints if /realtime is not browser-accessible

=================================================
END OF REPORT
=================================================
    `.trim();

    navigator.clipboard.writeText(report);
    toast.success('Support report copied to clipboard!', {
      description: 'You can now paste this into your support ticket.'
    });
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">AllTick API Diagnostics</h3>
        <p className="text-sm text-muted-foreground mb-4">
          API Key: {apiKey?.substring(0, 20)}...{apiKey?.substring(apiKey.length - 6)}
        </p>
        <div className="flex gap-2">
          <Button onClick={runDiagnostics} disabled={testing}>
            {testing ? 'Running Tests...' : 'Run Diagnostics'}
          </Button>
          {results.length > 0 && (
            <Button onClick={generateSupportReport} variant="outline">
              <Copy className="mr-2 h-4 w-4" />
              Copy Support Report
            </Button>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {results.map((result, idx) => (
            <div 
              key={idx} 
              className={`p-3 rounded border ${
                result.success 
                  ? 'bg-success/10 border-success/30 text-foreground' 
                  : 'bg-destructive/10 border-destructive/30 text-foreground'
              }`}
            >
              <div className="font-semibold flex items-center gap-2">
                {result.success ? '✅' : '❌'} {result.test}
              </div>
              <pre className="text-xs mt-2 overflow-x-auto text-foreground">
                {JSON.stringify(result.details, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
