import { useEffect, useRef, useState } from "react";

interface TradingChartProps {
  symbol: string;
}

export const TradingChart = ({ symbol }: TradingChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displaySymbol, setDisplaySymbol] = useState<string>("");

  // ULTRA-CONSERVATIVE: Only use symbols 100% confirmed to work in FREE TradingView widget
  const getProperSymbol = (symbol: string): string => {
    console.log(`[TradingChart] Getting symbol for: ${symbol}`);
    
    // MINIMAL GUARANTEED FREE SYMBOLS - Only the most basic ones
    const guaranteedSymbols: Record<string, string> = {
      // Top Cryptocurrencies (BINANCE confirmed free)
      'BTCUSD': 'BTCUSDT',
      'ETHUSD': 'ETHUSDT',
      'BNBUSD': 'BNBUSDT',
      'ADAUSD': 'ADAUSDT',
      'SOLUSD': 'SOLUSDT',
      'XRPUSD': 'XRPUSDT',
      'DOGEUSD': 'DOGEUSDT',
      'AVAXUSD': 'AVAXUSDT',
      'DOTUSD': 'DOTUSDT',
      'MATICUSD': 'MATICUSDT',
      'LINKUSD': 'LINKUSDT',
      'LTCUSD': 'LTCUSDT',
      
      // Major US Stocks (no exchange prefix - most basic)
      'AAPL': 'AAPL',
      'MSFT': 'MSFT', 
      'GOOGL': 'GOOGL',
      'AMZN': 'AMZN',
      'TSLA': 'TSLA',
      'META': 'META',
      'NVDA': 'NVDA',
      'JPM': 'JPM',
      'JNJ': 'JNJ',
      'WMT': 'WMT',
      
      // Major Forex (no prefix - most basic)
      'EURUSD': 'EURUSD',
      'GBPUSD': 'GBPUSD', 
      'USDJPY': 'USDJPY',
      'AUDUSD': 'AUDUSD',
      'USDCAD': 'USDCAD',
      'USDCHF': 'USDCHF',
      'NZDUSD': 'NZDUSD',
      
      // Basic Indices (no prefix)
      'SPX500': 'SPX',
      'US30': 'DJI',
      'NAS100': 'NDX',
      'VIX': 'VIX',
      
      // Basic Commodities (no prefix)
      'XAUUSD': 'GOLD',
      'XAGUSD': 'SILVER', 
      'WTIUSD': 'USOIL',
    };

    // Direct mapping first
    if (guaranteedSymbols[symbol]) {
      const mapped = guaranteedSymbols[symbol];
      console.log(`[TradingChart] Direct mapping: ${symbol} -> ${mapped}`);
      setDisplaySymbol(mapped);
      return mapped;
    }

    // Category-based fallbacks to guaranteed symbols
    console.log(`[TradingChart] No direct mapping for ${symbol}, using category fallback`);
    
    // Crypto fallback -> Bitcoin
    if (symbol.includes('USD') && (symbol.length <= 7 || ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'LINK', 'LTC'].some(crypto => symbol.includes(crypto)))) {
      console.log(`[TradingChart] Crypto fallback: ${symbol} -> BTCUSDT`);
      setDisplaySymbol('BTCUSDT (Bitcoin)');
      return 'BTCUSDT';
    }
    
    // Stock fallback -> Apple
    if (symbol.length <= 4 && !symbol.includes('USD') && symbol === symbol.toUpperCase()) {
      console.log(`[TradingChart] Stock fallback: ${symbol} -> AAPL`);
      setDisplaySymbol('AAPL (Apple)');
      return 'AAPL';
    }
    
    // Forex fallback -> EUR/USD
    if (symbol.includes('USD') || symbol.length === 6) {
      console.log(`[TradingChart] Forex fallback: ${symbol} -> EURUSD`);
      setDisplaySymbol('EURUSD (Euro/Dollar)');
      return 'EURUSD';
    }
    
    // Index fallback -> S&P 500
    if (symbol.includes('30') || symbol.includes('500') || symbol.includes('100')) {
      console.log(`[TradingChart] Index fallback: ${symbol} -> SPX`);
      setDisplaySymbol('SPX (S&P 500)');
      return 'SPX';
    }
    
    // Commodity fallback -> Gold
    if (symbol.includes('XAU') || symbol.includes('GOLD') || symbol.includes('WTI') || symbol.includes('OIL')) {
      console.log(`[TradingChart] Commodity fallback: ${symbol} -> GOLD`);
      setDisplaySymbol('GOLD (Gold Spot)');
      return 'GOLD';
    }
    
    // Ultimate fallback -> S&P 500
    console.log(`[TradingChart] Ultimate fallback: ${symbol} -> SPX`);
    setDisplaySymbol('SPX (S&P 500)');
    return 'SPX';
  };

  useEffect(() => {
    if (!chartRef.current) return;

    setIsLoading(true);
    setError(null);
    
    const tradingViewSymbol = getProperSymbol(symbol);
    console.log(`[TradingChart] Loading widget for symbol: ${tradingViewSymbol}`);

    // Clean up previous widget
    if (chartRef.current) {
      chartRef.current.innerHTML = '';
    }

    // Create TradingView widget with error handling
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    
    script.onload = () => {
      try {
        if (window.TradingView && chartRef.current) {
          console.log(`[TradingView] Creating widget for: ${tradingViewSymbol}`);
          
          new window.TradingView.widget({
            autosize: true,
            symbol: tradingViewSymbol,
            interval: "5", // 5-minute interval (more reliable than 1m)
            timezone: "Etc/UTC",
            theme: document.documentElement.classList.contains('dark') ? "dark" : "light",
            style: "1", 
            locale: "en",
            toolbar_bg: document.documentElement.classList.contains('dark') ? "#1f2937" : "#f1f3f6",
            enable_publishing: false,
            withdateranges: true,
            hide_side_toolbar: false,
            allow_symbol_change: false,
            container_id: chartRef.current.id,
            height: 400,
            onChartReady: () => {
              console.log(`[TradingView] Chart ready for: ${tradingViewSymbol}`);
              setIsLoading(false);
            },
          });
          
          // Set timeout to detect loading issues
          setTimeout(() => {
            if (isLoading) {
              console.warn(`[TradingView] Chart taking too long to load: ${tradingViewSymbol}`);
              setError(`Chart loading timeout for ${displaySymbol || symbol}`);
              setIsLoading(false);
            }
          }, 10000);
        }
      } catch (err) {
        console.error(`[TradingView] Widget creation failed:`, err);
        setError(`Failed to load chart for ${displaySymbol || symbol}`);
        setIsLoading(false);
      }
    };

    script.onerror = (err) => {
      console.error(`[TradingView] Script loading failed:`, err);
      setError('Failed to load TradingView library');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [symbol]);

  return (
    <div className="w-full h-96 bg-muted/20 rounded-lg relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10 rounded-lg">
          <div className="text-center space-y-2">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground">Loading {displaySymbol || symbol} chart...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 z-10 rounded-lg">
          <div className="text-center space-y-2 p-4">
            <p className="text-destructive font-medium">Chart Error</p>
            <p className="text-muted-foreground text-sm">{error}</p>
            <p className="text-xs text-muted-foreground">
              Showing fallback chart for {displaySymbol || symbol}
            </p>
          </div>
        </div>
      )}
      
      <div 
        id={`tradingview_chart_${symbol}`} 
        ref={chartRef} 
        className="w-full h-full rounded-lg"
      />
    </div>
  );
};

// Add TradingView types
declare global {
  interface Window {
    TradingView: any;
  }
}