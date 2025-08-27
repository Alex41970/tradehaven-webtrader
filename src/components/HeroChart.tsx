import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

interface ChartData {
  time: string;
  value: number;
}

const generateMockData = (): ChartData[] => {
  const data: ChartData[] = [];
  let value = 100;
  
  for (let i = 0; i < 50; i++) {
    value += (Math.random() - 0.5) * 5;
    data.push({
      time: `${i}`,
      value: Math.max(90, Math.min(120, value))
    });
  }
  
  return data;
};

export const HeroChart = () => {
  const [data, setData] = useState<ChartData[]>(generateMockData());

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => {
        const newData = [...prev.slice(1)];
        const lastValue = newData[newData.length - 1]?.value || 100;
        const newValue = lastValue + (Math.random() - 0.5) * 3;
        
        newData.push({
          time: `${newData.length}`,
          value: Math.max(90, Math.min(120, newValue))
        });
        
        return newData;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const currentValue = data[data.length - 1]?.value || 100;
  const previousValue = data[data.length - 2]?.value || 100;
  const isPositive = currentValue >= previousValue;

  return (
    <div className="relative">
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-border/50">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Market Index</h3>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{currentValue.toFixed(2)}</span>
            <span className={`text-sm font-medium ${
              isPositive ? 'text-trading-success' : 'text-trading-danger'
            }`}>
              {isPositive ? '+' : ''}{((currentValue - previousValue) / previousValue * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
      
      <div className="h-80 w-full bg-gradient-to-br from-trading-primary/10 to-trading-secondary/10 rounded-xl overflow-hidden border border-border/50">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis hide />
            <YAxis hide />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--trading-accent))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--trading-accent))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};