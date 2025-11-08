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
    <>
      {prefix}{formatNumber(count)}{suffix}
    </>
  );
};

export const TradingStats = () => {
  return (
    <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
      {stats.map((stat, index) => (
        <div key={index} className="flex sm:flex-col items-center sm:text-center gap-4 sm:gap-0">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-accent/20 to-accent/5 rounded-lg flex items-center justify-center border border-accent/30 flex-shrink-0 sm:mx-auto sm:mb-4">
            <stat.icon className="h-6 w-6 sm:h-8 sm:w-8 text-accent" />
          </div>
          <div className="flex-1 sm:flex-none">
            <div className="mb-1 sm:mb-2 text-accent drop-shadow-[0_0_8px_rgba(240,185,11,0.3)]">
              <span className="font-bold text-xl sm:text-2xl md:text-3xl">
                <AnimatedCounter 
                  end={parseInt(stat.value)} 
                  prefix={stat.suffix === "$" ? "$" : ""} 
                  suffix={stat.suffix !== "$" ? stat.suffix : ""} 
                />
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};