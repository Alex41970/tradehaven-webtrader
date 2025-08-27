import { useEffect, useRef } from "react";

interface TradingChartProps {
  symbol: string;
}

export const TradingChart = ({ symbol }: TradingChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

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
          symbol: symbol === "BTCUSD" ? "BINANCE:BTCUSDT" : 
                  symbol === "AAPL" ? "NASDAQ:AAPL" :
                  symbol === "TSLA" ? "NASDAQ:TSLA" :
                  `FX:${symbol}`,
          interval: "15",
          timezone: "Etc/UTC",
          theme: "light",
          style: "1",
          locale: "en",
          toolbar_bg: "#f1f3f6",
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