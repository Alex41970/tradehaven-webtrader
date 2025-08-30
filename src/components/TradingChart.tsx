import { useEffect, useRef } from "react";

interface TradingChartProps {
  symbol: string;
}

export const TradingChart = ({ symbol }: TradingChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // Map asset symbols to proper TradingView symbols (FREE WIDGET COMPATIBLE)
  const getProperSymbol = (symbol: string): string => {
    console.log(`[TradingChart] Mapping symbol: ${symbol}`);
    
    const symbolMappings: Record<string, string> = {
      // Crypto (BINANCE works reliably in free widget)
      'BTCUSD': 'BINANCE:BTCUSDT',
      'ETHUSD': 'BINANCE:ETHUSDT', 
      'XRPUSD': 'BINANCE:XRPUSDT',
      'ADAUSD': 'BINANCE:ADAUSDT',
      'DOTUSD': 'BINANCE:DOTUSDT',
      'AVAXUSD': 'BINANCE:AVAXUSDT',
      'DOGEUSD': 'BINANCE:DOGEUSDT',
      'SHIBUSD': 'BINANCE:SHIBUSDT',
      'UNIUSD': 'BINANCE:UNIUSDT',
      'TRXUSD': 'BINANCE:TRXUSDT',
      'ATOMUSD': 'BINANCE:ATOMUSDT',
      'NEARUSD': 'BINANCE:NEARUSDT',
      'APTUSD': 'BINANCE:APTUSDT',
      'ARBUSD': 'BINANCE:ARBUSDT',
      'OPUSD': 'BINANCE:OPUSDT',
      'PEPEUSD': 'BINANCE:PEPEUSDT',
      'FLOKIUSD': 'BINANCE:FLOKIUSDT',
      'BNBUSD': 'BINANCE:BNBUSDT',
      'SOLUSD': 'BINANCE:SOLUSDT',
      'LINKUSD': 'BINANCE:LINKUSDT',
      'LTCUSD': 'BINANCE:LTCUSDT',
      'MATICUSD': 'BINANCE:MATICUSDT',
      
      // Major US Stocks (only widely available ones)
      'AAPL': 'NASDAQ:AAPL',
      'GOOGL': 'NASDAQ:GOOGL',
      'TSLA': 'NASDAQ:TSLA',
      'MSFT': 'NASDAQ:MSFT',
      'AMZN': 'NASDAQ:AMZN',
      'NVDA': 'NASDAQ:NVDA',
      'META': 'NASDAQ:META',
      'ADBE': 'NASDAQ:ADBE',
      'CRM': 'NYSE:CRM',
      'ORCL': 'NYSE:ORCL',
      'CSCO': 'NASDAQ:CSCO',
      'INTC': 'NASDAQ:INTC',
      'AMD': 'NASDAQ:AMD',
      'JPM': 'NYSE:JPM',
      'BAC': 'NYSE:BAC',
      'WFC': 'NYSE:WFC',
      'GS': 'NYSE:GS',
      'KO': 'NYSE:KO',
      'MCD': 'NYSE:MCD',
      'WMT': 'NYSE:WMT',
      'PG': 'NYSE:PG',
      'NKE': 'NYSE:NKE',
      'JNJ': 'NYSE:JNJ',
      'PFE': 'NYSE:PFE',
      'UNH': 'NYSE:UNH',
      'ABBV': 'NYSE:ABBV',
      'XOM': 'NYSE:XOM',
      'CVX': 'NYSE:CVX',
      'COP': 'NYSE:COP',
      
      // Major Forex (FX: prefix works reliably)
      'EURUSD': 'FX:EURUSD',
      'GBPUSD': 'FX:GBPUSD',
      'USDJPY': 'FX:USDJPY',
      'USDCHF': 'FX:USDCHF',
      'AUDUSD': 'FX:AUDUSD',
      'USDCAD': 'FX:USDCAD',
      'NZDUSD': 'FX:NZDUSD',
      'EURJPY': 'FX:EURJPY',
      'GBPJPY': 'FX:GBPJPY',
      'USDTRY': 'FX:USDTRY',
      'USDZAR': 'FX:USDZAR',
      'USDMXN': 'FX:USDMXN',
      'USDSGD': 'FX:USDSGD',
      'USDNOK': 'FX:USDNOK',
      'USDSEK': 'FX:USDSEK',
      'USDDKK': 'FX:USDDKK',
      'USDPLN': 'FX:USDPLN',
      'CADJPY': 'FX:CADJPY',
      'AUDJPY': 'FX:AUDJPY',
      'NZDJPY': 'FX:NZDJPY',
      'EURGBP': 'FX:EURGBP',
      
      // Major Global Indices (TVC: prefix for major ones)
      'US30': 'TVC:DJI',
      'DJ30': 'TVC:DJI',
      'SPX500': 'TVC:SPX',
      'NAS100': 'TVC:NDX',
      'UK100': 'TVC:UKX',
      'GER40': 'TVC:DAX',
      'EU50': 'TVC:SX5E',
      'FRA40': 'TVC:CAC',
      'ITA40': 'TVC:FTSEMIB',
      'SPA35': 'TVC:IBEX35',
      'HK50': 'TVC:HSI',
      'CHN50': 'TVC:SHCOMP',
      'US2000': 'TVC:RUT',
      'VIX': 'TVC:VIX',
      'JPN225': 'TVC:NI225',
      // Fallback regional indices to major global ones
      'CAN60': 'TVC:SPX', // Fallback to S&P 500
      'AUS200': 'TVC:SPX', // Fallback to S&P 500
      
      // Basic Commodities (TVC: spot prices only - no futures)
      'XAUUSD': 'TVC:GOLD',
      'XAGUSD': 'TVC:SILVER',
      'XPTUSD': 'TVC:PLATINUM',
      'XPDUSD': 'TVC:PALLADIUM',
      'COPPER': 'TVC:COPPER',
      'ALUMINUM': 'TVC:COPPER', // Fallback to copper
      'ZINC': 'TVC:COPPER', // Fallback to copper  
      'PLATINUM': 'TVC:PLATINUM',
      'PALLADIUM': 'TVC:PALLADIUM',
      
      // Energy Commodities (TVC: spot prices)
      'WTIUSD': 'TVC:USOIL',
      'BCOUSD': 'TVC:UKOIL',
      'NATGAS': 'TVC:NATURALGAS',
      'HEATING': 'TVC:USOIL', // Fallback to crude oil
      'GASOLINE': 'TVC:USOIL', // Fallback to crude oil
      
      // Agricultural Commodities (TVC: basic symbols)
      'WHEAT': 'TVC:WHEAT',
      'CORN': 'TVC:CORN',
      'SOYBEANS': 'TVC:SOYBEAN',
      'SUGAR': 'TVC:SUGAR',
      'COFFEE': 'TVC:COFFEE',
      'COTTON': 'TVC:COTTON',
      'COCOA': 'TVC:COCOA',
    };
    
    const mappedSymbol = symbolMappings[symbol];
    if (mappedSymbol) {
      console.log(`[TradingChart] Mapped ${symbol} -> ${mappedSymbol}`);
      return mappedSymbol;
    }
    
    // Enhanced fallback logic
    console.log(`[TradingChart] No mapping found for ${symbol}, using fallback logic`);
    
    // Crypto fallback - try BINANCE
    if (symbol.includes('USD') && (symbol.includes('BTC') || symbol.includes('ETH') || symbol.length <= 6)) {
      const fallback = `BINANCE:${symbol.replace('USD', 'USDT')}`;
      console.log(`[TradingChart] Crypto fallback: ${fallback}`);
      return fallback;
    }
    
    // Forex fallback - try FX prefix
    if (symbol.includes('USD') || symbol.length === 6) {
      const fallback = `FX:${symbol}`;
      console.log(`[TradingChart] Forex fallback: ${fallback}`);
      return fallback;
    }
    
    // Stock fallback - try NASDAQ for 3-4 letter symbols
    if (symbol.length <= 4 && !symbol.includes('USD')) {
      const fallback = `NASDAQ:${symbol}`;
      console.log(`[TradingChart] Stock fallback: ${fallback}`);
      return fallback;
    }
    
    // Ultimate fallback - show S&P 500
    console.log(`[TradingChart] Using ultimate fallback: TVC:SPX`);
    return 'TVC:SPX';
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