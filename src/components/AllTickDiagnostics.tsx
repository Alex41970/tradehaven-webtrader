import { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { toast } from 'sonner';
import { Copy, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const AllTickDiagnostics = () => {
  const [results, setResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  // Note: API key is now stored securely in Supabase secrets, not in frontend env

  const runDiagnostics = async () => {
    setTesting(true);
    setResults([]);

    // Run comprehensive diagnostics (includes auth verification)
    try {
      console.log('Running diagnostics via edge function...');
      const { data, error } = await supabase.functions.invoke('alltick-diagnostics');
      
      if (error) throw error;
      
      if (data?.results && Array.isArray(data.results)) {
        setResults(prev => [...prev, ...data.results.map((r: any) => ({
          test: r.test,
          success: r.success,
          details: {
            message: r.details,
            responseData: r.responseData
          }
        }))]);
      }
    } catch (error: any) {
      setResults(prev => [...prev, {
        test: 'Full Diagnostics',
        success: false,
        details: { error: error.message }
      }]);
    }

    setTesting(false);
  };

  const generateSupportReport = () => {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    const report = `
=================================================
ALLTICK API DIAGNOSTIC REPORT
=================================================

ENVIRONMENT:
-----------
Date: ${new Date().toISOString()}
Test Method: Server-side via Supabase Edge Functions
Browser: ${navigator.userAgent}

API CREDENTIALS:
---------------
API Key: Stored securely in Supabase secrets (not exposed to frontend)

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

ENDPOINTS TESTED:
------------------
1. GET https://quote.alltick.io/quote-b-api/trade-tick
   - Used for: Forex, Crypto, Commodities
   - Method: GET with token and query URL parameters
   
2. GET https://quote.alltick.io/quote-stock-b-api/trade-tick
   - Used for: Stocks, Indices
   - Method: GET with token and query URL parameters

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
        <div className="flex items-start gap-2 mb-3 p-3 bg-muted/50 rounded-lg">
          <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Tests run server-side via Supabase edge functions to avoid CORS issues.
          </p>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          API Key: Stored securely in Supabase secrets (server-side only)
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
