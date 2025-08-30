import { useEffect, useRef, useState } from "react";

interface TradingChartProps {
  symbol: string;
}

export const TradingChart = ({ symbol }: TradingChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displaySymbol, setDisplaySymbol] = useState<string>("");

  // Simple mappings for original 46 assets - focus on what works reliably
  const getProperSymbol = (symbol: string): string => {
    console.log(`[TradingChart] Getting symbol for: ${symbol}`);
    
    // Direct mappings for original assets that work with free TradingView
    const symbolMappings: Record<string, string> = {
      // Crypto - use simple USD pairs
      'BTCUSD': 'BTCUSD',
      'ETHUSD': 'ETHUSD', 
      'BNBUSD': 'BNBUSD',
      'LTCUSD': 'LTCUSD',
      'SOLUSD': 'SOLUSD',
      'XRPUSD': 'XRPUSD',
      'MATICUSD': 'MATICUSD',
      'DOTUSD': 'DOTUSD',
      'LINKUSD': 'LINKUSD',
      
      // Stocks - use basic symbols
      'AAPL': 'AAPL',
      'MSFT': 'MSFT',
      'GOOGL': 'GOOGL', 
      'AMZN': 'AMZN',
      'TSLA': 'TSLA',
      'META': 'META',
      'NVDA': 'NVDA',
      'NFLX': 'NFLX',
      'INTC': 'INTC',
      
      // Forex - use standard pairs
      'EURUSD': 'EURUSD',
      'GBPUSD': 'GBPUSD',
      'USDJPY': 'USDJPY', 
      'AUDUSD': 'AUDUSD',
      'USDCAD': 'USDCAD',
      'USDCHF': 'USDCHF',
      'NZDUSD': 'NZDUSD',
      'EURGBP': 'EURGBP',
      'EURJPY': 'EURJPY',
      
      // Indices - use basic forms
      'SPX500': 'SPX',
      'NAS100': 'IXIC',
      'UK100': 'UKX',
      'JPN225': 'N225',
      'GER40': 'DAX',
      'FRA40': 'CAC',
      'AUS200': 'AS51',
      
      // Commodities - use spot symbols
      'XAUUSD': 'XAUUSD',
      'XAGUSD': 'XAGUSD',
      'WTIUSD': 'USOIL',
      'NATGAS': 'NGAS',
      'XPTUSD': 'XPTUSD',
      'XPDUSD': 'XPDUSD',
    };

    // Direct mapping first
    if (symbolMappings[symbol]) {
      const mapped = symbolMappings[symbol];
      console.log(`[TradingChart] Direct mapping: ${symbol} -> ${mapped}`);
      setDisplaySymbol(mapped);
      return mapped;
    }

    // Simple fallbacks for unmapped symbols
    console.log(`[TradingChart] No direct mapping for ${symbol}, using fallback`);
    
    // Default to Bitcoin for any crypto-like symbols
    if (symbol.includes('USD') && symbol.length <= 7) {
      setDisplaySymbol('BTCUSD (Bitcoin)');
      return 'BTCUSD';
    }
    
    // Default to Apple for stock-like symbols  
    if (symbol.length <= 4 && !symbol.includes('USD')) {
      setDisplaySymbol('AAPL (Apple)');
      return 'AAPL';
    }
    
    // Ultimate fallback -> EUR/USD
    setDisplaySymbol('EURUSD (Euro/Dollar)');
    return 'EURUSD';
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