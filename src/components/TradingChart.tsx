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
      'CAN60': 'TSX:TSX',
      'VIX': 'TVC:VIX',
      'AUS200': 'TVC:AS51',
      'JPN225': 'TVC:NI225',
      
      // Commodities - Metals
      'XAUUSD': 'TVC:GOLD',
      'XAGUSD': 'TVC:SILVER',
      'XPTUSD': 'TVC:PLATINUM',
      'XPDUSD': 'TVC:PALLADIUM',
      'COPPER': 'COMEX:HG1!',
      'ALUMINUM': 'LME:AH1!',
      'ZINC': 'LME:ZS1!',
      'PLATINUM': 'NYMEX:PL1!',
      'PALLADIUM': 'NYMEX:PA1!',
      
      // Commodities - Energy
      'WTIUSD': 'TVC:USOIL',
      'BCOUSD': 'TVC:UKOIL',
      'NATGAS': 'NYMEX:NG1!',
      'HEATING': 'NYMEX:HO1!',
      'GASOLINE': 'NYMEX:RB1!',
      
      // Commodities - Agricultural
      'WHEAT': 'CBOT:ZW1!',
      'CORN': 'CBOT:ZC1!',
      'SOYBEANS': 'CBOT:ZS1!',
      'SUGAR': 'ICE:SB1!',
      'COFFEE': 'ICE:KC1!',
      'COTTON': 'ICE:CT1!',
      'COCOA': 'ICE:CC1!',
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