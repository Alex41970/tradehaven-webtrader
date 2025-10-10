import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { resolveTVSymbol } from "@/utils/tradingviewSymbolResolver";

interface TradingChartProps {
  symbol: string;
  category?: string;
  name?: string;
}

export const TradingChart = ({ symbol, category, name }: TradingChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!chartRef.current) return;

    // Cleanup previous widget
    if (widgetRef.current) {
      try {
        widgetRef.current.remove();
      } catch (error) {
        console.log('Widget cleanup error:', error);
      }
      widgetRef.current = null;
    }

    // Clear the container
    if (chartRef.current) {
      chartRef.current.innerHTML = '<div class="text-center text-muted-foreground">Loading ' + symbol + ' chart...</div>';
    }

    // Check if TradingView is already loaded
    if (window.TradingView) {
      createWidget();
    } else {
      // Load TradingView script if not already loaded
      const existingScript = document.querySelector('script[src*="tradingview.com/tv.js"]');
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = createWidget;
        document.head.appendChild(script);
      } else {
        // Script exists but TradingView might not be ready yet
        const checkTradingView = () => {
          if (window.TradingView) {
            createWidget();
          } else {
            setTimeout(checkTradingView, 100);
          }
        };
        checkTradingView();
      }
    }

    function createWidget() {
      if (!chartRef.current || !window.TradingView) return;
      
      try {
        const isDark = theme === 'dark';
        const tvSymbol = resolveTVSymbol({ symbol, category, name });
        
        widgetRef.current = new window.TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: "1",
          timezone: "Etc/UTC",
          theme: isDark ? "dark" : "light",
          style: "1", 
          locale: "en",
          toolbar_bg: isDark ? "#1f2937" : "#f1f3f6",
          enable_publishing: false,
          withdateranges: true,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          container_id: chartRef.current?.id || "tradingview_chart",
          height: 400,
        });
      } catch (error) {
        console.error('Error creating TradingView widget:', error);
      }
    }

    return () => {
      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
        } catch (error) {
          console.log('Widget cleanup error:', error);
        }
        widgetRef.current = null;
      }
    };
  }, [symbol, theme]);

  return (
    <div className="w-full h-96 bg-muted/20 rounded-lg flex items-center justify-center animate-fade-in">
      <div id="tradingview_chart" ref={chartRef} className="w-full h-full">
        <div className="text-center text-muted-foreground animate-pulse">
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