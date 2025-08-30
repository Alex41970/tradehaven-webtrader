import { useEffect, useRef, useState } from "react";

interface TradingChartProps {
  symbol: string;
}

export const TradingChart = ({ symbol }: TradingChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displaySymbol, setDisplaySymbol] = useState<string>("");

  // Complete mappings for all current assets - optimized for TradingView free widgets
  const getProperSymbol = (symbol: string): string => {
    console.log(`[TradingChart] Getting symbol for: ${symbol}`);
    
    // Complete mappings for all database assets
    const symbolMappings: Record<string, string> = {
      // Crypto - use BINANCE exchange for reliability
      'BTCUSD': 'BINANCE:BTCUSDT',
      'ETHUSD': 'BINANCE:ETHUSDT', 
      'BNBUSD': 'BINANCE:BNBUSDT',
      'LTCUSD': 'BINANCE:LTCUSDT',
      'SOLUSD': 'BINANCE:SOLUSDT',
      'XRPUSD': 'BINANCE:XRPUSDT',
      'MATICUSD': 'BINANCE:MATICUSDT',
      'DOTUSD': 'BINANCE:DOTUSDT',
      'LINKUSD': 'BINANCE:LINKUSDT',
      'ADAUSD': 'BINANCE:ADAUSDT',
      
      // Stocks - use basic NASDAQ symbols
      'AAPL': 'NASDAQ:AAPL',
      'MSFT': 'NASDAQ:MSFT',
      'GOOGL': 'NASDAQ:GOOGL', 
      'AMZN': 'NASDAQ:AMZN',
      'TSLA': 'NASDAQ:TSLA',
      'META': 'NASDAQ:META',
      'NVDA': 'NASDAQ:NVDA',
      'NFLX': 'NASDAQ:NFLX',
      'INTC': 'NASDAQ:INTC',
      'AMD': 'NASDAQ:AMD',
      
      // Forex - use FX_IDC for reliability
      'EURUSD': 'FX_IDC:EURUSD',
      'GBPUSD': 'FX_IDC:GBPUSD',
      'USDJPY': 'FX_IDC:USDJPY', 
      'AUDUSD': 'FX_IDC:AUDUSD',
      'USDCAD': 'FX_IDC:USDCAD',
      'USDCHF': 'FX_IDC:USDCHF',
      'NZDUSD': 'FX_IDC:NZDUSD',
      'EURGBP': 'FX_IDC:EURGBP',
      'EURJPY': 'FX_IDC:EURJPY',
      'GBPJPY': 'FX_IDC:GBPJPY',
      
      // Indices - use TVC for global indices
      'SPX500': 'TVC:SPX',
      'NAS100': 'TVC:NDX',
      'UK100': 'TVC:UKX',
      'JPN225': 'TVC:NI225',
      'GER40': 'TVC:DAX',
      'FRA40': 'TVC:CAC',
      'AUS200': 'TVC:AS51',
      'DJ30': 'TVC:DJI',
      'US30': 'TVC:DJI',
      
      // Commodities - use TVC for commodities
      'XAUUSD': 'TVC:GOLD',
      'XAGUSD': 'TVC:SILVER',
      'WTIUSD': 'TVC:USOIL',
      'BCOUSD': 'TVC:UKOIL',
      'NATGAS': 'TVC:NATURALGAS',
      'XPTUSD': 'TVC:PLATINUM',
      'XPDUSD': 'TVC:PALLADIUM',
    };

    // Direct mapping - should cover all assets now
    if (symbolMappings[symbol]) {
      const mapped = symbolMappings[symbol];
      console.log(`[TradingChart] Mapped: ${symbol} -> ${mapped}`);
      setDisplaySymbol(symbol);
      return mapped;
    }

    // Fallback (should rarely be used now)
    console.log(`[TradingChart] No mapping for ${symbol}, using EURUSD fallback`);
    setDisplaySymbol(`${symbol} (Using EUR/USD)`);
    return 'FX_IDC:EURUSD';
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

    // Check if TradingView is already loaded to avoid reloading script
    if (window.TradingView) {
      createWidget(tradingViewSymbol);
    } else {
      // Load TradingView script only once
      const existingScript = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => createWidget(tradingViewSymbol);
        script.onerror = () => {
          console.error(`[TradingView] Script loading failed`);
          setError('Failed to load TradingView library');
          setIsLoading(false);
        };
        document.head.appendChild(script);
      }
    }

    function createWidget(tvSymbol: string) {
      try {
        if (window.TradingView && chartRef.current) {
          console.log(`[TradingView] Creating widget for: ${tvSymbol}`);
          
          new window.TradingView.widget({
            autosize: true,
            symbol: tvSymbol,
            interval: "15", // 15-minute for better performance
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
              console.log(`[TradingView] Chart ready for: ${tvSymbol}`);
              setIsLoading(false);
            },
          });
          
          // Faster timeout for quicker error detection
          setTimeout(() => {
            if (isLoading) {
              console.warn(`[TradingView] Chart loading timeout: ${tvSymbol}`);
              setError(`Chart loading timeout for ${displaySymbol || symbol}`);
              setIsLoading(false);
            }
          }, 5000);
        }
      } catch (err) {
        console.error(`[TradingView] Widget creation failed:`, err);
        setError(`Failed to load chart for ${displaySymbol || symbol}`);
        setIsLoading(false);
      }
    }
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