import { useEffect, useState } from "react";
import { Users, DollarSign, TrendingUp, Shield } from "lucide-react";

interface StatItem {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  suffix: string;
}

const stats: StatItem[] = [
  { icon: Users, label: "Active Traders", value: "500000", suffix: "+" },
  { icon: DollarSign, label: "Daily Volume", value: "2500000000", suffix: "$" },
  { icon: TrendingUp, label: "Assets Available", value: "10000", suffix: "+" },
  { icon: Shield, label: "Years Experience", value: "15", suffix: "+" },
];

const AnimatedCounter = ({ end, duration = 2000, prefix = "", suffix = "" }: {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      setCount(Math.floor(progress * end));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + "B";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(0) + "K";
    return num.toString();
  };

  return (
    <span className="font-bold text-2xl md:text-3xl">
      {prefix}{formatNumber(count)}{suffix}
    </span>
  );
};

export const TradingStats = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
      {stats.map((stat, index) => (
        <div key={index} className="text-center group">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-trading-accent/20 to-trading-primary/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
            <stat.icon className="h-8 w-8 text-trading-accent" />
          </div>
          <div className="mb-2">
            <AnimatedCounter 
              end={parseInt(stat.value)} 
              prefix={stat.suffix === "$" ? "$" : ""} 
              suffix={stat.suffix !== "$" ? stat.suffix : ""} 
            />
          </div>
          <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
        </div>
      ))}
    </div>
  );
};