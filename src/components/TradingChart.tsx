import { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface TradingChartProps {
  symbol: string;
}

interface ChartDataPoint {
  time: string;
  price: number;
  timestamp: number;
}

export const TradingChart = ({ symbol }: TradingChartProps) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Get appropriate decimal places based on price level
  const getDecimalPlaces = (price: number): number => {
    if (price < 1) return 4;
    if (price < 10) return 3;
    if (price < 100) return 2;
    return 2;
  };

  // Generate mock base price for different asset types
  const getBasePrice = (symbol: string): number => {
    // Crypto
    if (['BTCUSD'].includes(symbol)) return 65000;
    if (['ETHUSD'].includes(symbol)) return 3200;
    if (['BNBUSD'].includes(symbol)) return 320;
    if (['LTCUSD'].includes(symbol)) return 95;
    if (['SOLUSD'].includes(symbol)) return 85;
    if (['XRPUSD'].includes(symbol)) return 0.52;
    if (['MATICUSD'].includes(symbol)) return 0.95;
    if (['DOTUSD'].includes(symbol)) return 7.2;
    if (['LINKUSD'].includes(symbol)) return 14.5;
    if (['ADAUSD'].includes(symbol)) return 0.48;

    // Stocks
    if (['AAPL'].includes(symbol)) return 185;
    if (['MSFT'].includes(symbol)) return 420;
    if (['GOOGL'].includes(symbol)) return 165;
    if (['AMZN'].includes(symbol)) return 145;
    if (['TSLA'].includes(symbol)) return 248;
    if (['META'].includes(symbol)) return 325;
    if (['NVDA'].includes(symbol)) return 125;
    if (['NFLX'].includes(symbol)) return 485;
    if (['INTC'].includes(symbol)) return 32;
    if (['AMD'].includes(symbol)) return 145;

    // Forex
    if (['EURUSD'].includes(symbol)) return 1.0845;
    if (['GBPUSD'].includes(symbol)) return 1.2720;
    if (['USDJPY'].includes(symbol)) return 149.85;
    if (['AUDUSD'].includes(symbol)) return 0.6654;
    if (['USDCAD'].includes(symbol)) return 1.3625;
    if (['USDCHF'].includes(symbol)) return 0.8748;
    if (['NZDUSD'].includes(symbol)) return 0.6125;
    if (['EURGBP'].includes(symbol)) return 0.8525;
    if (['EURJPY'].includes(symbol)) return 162.45;
    if (['GBPJPY'].includes(symbol)) return 190.65;

    // Indices
    if (['SPX500'].includes(symbol)) return 5475;
    if (['NAS100'].includes(symbol)) return 17850;
    if (['UK100'].includes(symbol)) return 8245;
    if (['JPN225'].includes(symbol)) return 38950;
    if (['GER40'].includes(symbol)) return 18650;
    if (['FRA40'].includes(symbol)) return 7525;
    if (['AUS200'].includes(symbol)) return 7945;
    if (['DJ30', 'US30'].includes(symbol)) return 40850;

    // Commodities
    if (['XAUUSD'].includes(symbol)) return 2485;
    if (['XAGUSD'].includes(symbol)) return 28.45;
    if (['WTIUSD'].includes(symbol)) return 73.25;
    if (['BCOUSD'].includes(symbol)) return 76.85;
    if (['NATGAS'].includes(symbol)) return 2.85;
    if (['XPTUSD'].includes(symbol)) return 925;
    if (['XPDUSD'].includes(symbol)) return 1045;

    // Default fallback
    return 100;
  };

  // Generate initial chart data
  const generateChartData = useMemo(() => {
    const basePrice = getBasePrice(symbol);
    const data: ChartDataPoint[] = [];
    const now = Date.now();
    
    // Generate 50 data points over the last 4 hours (roughly 5-minute intervals)
    for (let i = 49; i >= 0; i--) {
      const timestamp = now - (i * 5 * 60 * 1000); // 5 minutes apart
      const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
      const price = basePrice * (1 + variation * (i / 10)); // Gradual trend
      
      data.push({
        time: new Date(timestamp).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        price: Number(price.toFixed(getDecimalPlaces(basePrice))),
        timestamp
      });
    }
    
    return data;
  }, [symbol]);


  // Initialize chart data
  useEffect(() => {
    setChartData(generateChartData);
    setCurrentPrice(generateChartData[generateChartData.length - 1]?.price || 0);
    setIsLoading(false);
  }, [generateChartData]);

  // Simulate real-time price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setChartData(prevData => {
        if (prevData.length === 0) return prevData;
        
        const lastPrice = prevData[prevData.length - 1].price;
        const variation = (Math.random() - 0.5) * 0.005; // ±0.5% variation
        const newPrice = lastPrice * (1 + variation);
        const roundedPrice = Number(newPrice.toFixed(getDecimalPlaces(newPrice)));
        
        setCurrentPrice(roundedPrice);
        
        const newDataPoint: ChartDataPoint = {
          time: new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          price: roundedPrice,
          timestamp: Date.now()
        };
        
        // Keep only last 50 points
        const newData = [...prevData.slice(1), newDataPoint];
        return newData;
      });
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-sm font-medium">
            <span className="text-primary">{symbol}:</span> ${data.value.toFixed(getDecimalPlaces(data.value))}
          </p>
        </div>
      );
    }
    return null;
  };

  // Determine chart color based on trend
  const getChartColor = () => {
    if (chartData.length < 2) return "hsl(var(--primary))";
    const firstPrice = chartData[0].price;
    const lastPrice = chartData[chartData.length - 1].price;
    return lastPrice >= firstPrice ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))";
  };

  if (isLoading) {
    return (
      <div className="w-full h-96 bg-muted/20 rounded-lg flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Loading {symbol} chart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-96 bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{symbol}</h3>
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold">
              ${currentPrice.toFixed(getDecimalPlaces(currentPrice))}
            </span>
            <div className="w-2 h-2 bg-chart-2 rounded-full animate-pulse"></div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Live • 5min intervals
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis 
              dataKey="time" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={['dataMin - 0.001', 'dataMax + 0.001']}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(value) => `$${value.toFixed(getDecimalPlaces(value))}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke={getChartColor()}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: getChartColor() }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
