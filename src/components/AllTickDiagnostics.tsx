import { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';

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

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">AllTick API Diagnostics</h3>
        <p className="text-sm text-muted-foreground mb-4">
          API Key: {apiKey?.substring(0, 20)}...{apiKey?.substring(apiKey.length - 6)}
        </p>
        <Button onClick={runDiagnostics} disabled={testing}>
          {testing ? 'Running Tests...' : 'Run Diagnostics'}
        </Button>
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
