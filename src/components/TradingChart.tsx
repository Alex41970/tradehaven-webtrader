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
      
      // Stocks
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
      
      // Forex
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
      
      // Indices
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
      'CAN60': 'TSX:XTSE',
      'VIX': 'TVC:VIX',
      'AUS200': 'ASX:XJO',
      'JPN225': 'TVC:NI225',
      
      // Commodities - Metals (using more reliable symbols)
      'XAUUSD': 'TVC:GOLD',
      'XAGUSD': 'TVC:SILVER',
      'XPTUSD': 'TVC:PLATINUM',
      'XPDUSD': 'TVC:PALLADIUM',
      'COPPER': 'COMEX:HG1!',
      'ALUMINUM': 'COMEX:HG1!', // Fallback to copper for LME issues
      'ZINC': 'COMEX:HG1!', // Fallback to copper for LME issues
      'PLATINUM': 'TVC:PLATINUM',
      'PALLADIUM': 'TVC:PALLADIUM',
      
      // Commodities - Energy
      'WTIUSD': 'TVC:USOIL',
      'BCOUSD': 'TVC:UKOIL',
      'NATGAS': 'TVC:NATURALGAS',
      'HEATING': 'TVC:USOIL', // Fallback to crude oil
      'GASOLINE': 'TVC:USOIL', // Fallback to crude oil
      
      // Commodities - Agricultural
      'WHEAT': 'CBOT:ZW1!',
      'CORN': 'CBOT:ZC1!',
      'SOYBEANS': 'CBOT:ZS1!',
      'SUGAR': 'TVC:SUGAR',
      'COFFEE': 'TVC:COFFEE',
      'COTTON': 'TVC:COTTON',
      'COCOA': 'TVC:COCOA',
    };
    
    // Better fallback strategy - try multiple options
    const mappedSymbol = symbolMappings[symbol];
    if (mappedSymbol) {
      return mappedSymbol;
    }
    
    // Fallback logic based on symbol pattern
    if (symbol.includes('USD')) {
      return `FX:${symbol}`;
    }
    
    // Default fallback to show at least something
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