import { useEffect, useRef } from "react";

interface TradingChartProps {
  symbol: string;
}

export const TradingChart = ({ symbol }: TradingChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // Map asset symbols to proper TradingView symbols
  const getProperSymbol = (symbol: string): string => {
    const symbolMappings: Record<string, string> = {
      // Crypto
      'BTCUSD': 'BINANCE:BTCUSDT',
      'ETHUSD': 'BINANCE:ETHUSDT', 
      'XRPUSD': 'BINANCE:XRPUSDT',
      'ADAUSD': 'BINANCE:ADAUSDT',
      'DOTUSD': 'BINANCE:DOTUSDT',
      
      // Stocks
      'AAPL': 'NASDAQ:AAPL',
      'GOOGL': 'NASDAQ:GOOGL',
      'TSLA': 'NASDAQ:TSLA',
      'MSFT': 'NASDAQ:MSFT',
      'AMZN': 'NASDAQ:AMZN',
      
      // Forex pairs
      'EURUSD': 'FX:EURUSD',
      'GBPUSD': 'FX:GBPUSD',
      'USDJPY': 'FX:USDJPY',
      'USDCHF': 'FX:USDCHF',
      'AUDUSD': 'FX:AUDUSD',
      'USDCAD': 'FX:USDCAD',
      'NZDUSD': 'FX:NZDUSD',
      
      // Commodities
      'XAUUSD': 'TVC:GOLD',
      'XAGUSD': 'TVC:SILVER',
      'WTIUSD': 'TVC:USOIL',
      'BCOUSD': 'TVC:UKOIL',
      
      // Indices
      'US30': 'TVC:DJI',
      'SPX500': 'TVC:SPX',
      'NAS100': 'TVC:NDX',
      'UK100': 'TVC:UKX',
      'GER40': 'TVC:DAX',
    };
    
    return symbolMappings[symbol] || `FX:${symbol}`;
  };

  useEffect(() => {
    if (!chartRef.current) return;

    // Create TradingView widget
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (window.TradingView) {
        new window.TradingView.widget({
          autosize: true,
          symbol: getProperSymbol(symbol),
          interval: "1",
          timezone: "Etc/UTC",
          theme: document.documentElement.classList.contains('dark') ? "dark" : "light",
          style: "1", 
          locale: "en",
          toolbar_bg: document.documentElement.classList.contains('dark') ? "#1f2937" : "#f1f3f6",
          enable_publishing: false,
          withdateranges: true,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          container_id: chartRef.current?.id || "tradingview_chart",
          height: 400,
        });
      }
    };

    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [symbol]);

  return (
    <div className="w-full h-96 bg-muted/20 rounded-lg flex items-center justify-center">
      <div id="tradingview_chart" ref={chartRef} className="w-full h-full">
        <div className="text-center text-muted-foreground">
          Loading {symbol} chart...
        </div>
      </div>
    </div>
  );
};

// Add TradingView types
declare global {
  interface Window {
    TradingView: any;
  }
}