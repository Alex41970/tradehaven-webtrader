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
    <>
      {/* Mobile: Horizontal scroll cards */}
      <div className="sm:hidden min-w-0 w-full">
        <div className="flex w-full overflow-x-auto overscroll-x-contain gap-4 pb-4 snap-x snap-mandatory px-4 scrollbar-hide" style={{ touchAction: 'pan-x' }}>
          {stats.map((stat, index) => (
            <div key={index} className="flex-shrink-0 w-[240px] snap-center">
              <div className="bg-card/50 backdrop-blur-sm border border-accent/20 rounded-xl p-6 text-center hover:border-accent/40 transition-all">
                <div className="w-14 h-14 bg-gradient-to-br from-accent/20 to-accent/5 rounded-lg flex items-center justify-center mb-4 mx-auto border border-accent/30">
                  <stat.icon className="h-7 w-7 text-accent" />
                </div>
                <div className="mb-2 text-accent drop-shadow-[0_0_8px_rgba(240,185,11,0.3)]">
                  <span className="font-bold text-2xl">
                    <AnimatedCounter 
                      end={parseInt(stat.value)} 
                      prefix={stat.suffix === "$" ? "$" : ""} 
                      suffix={stat.suffix !== "$" ? stat.suffix : ""} 
                    />
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tablet: 2x2 grid */}
      <div className="hidden sm:grid lg:hidden sm:grid-cols-2 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-accent/20 to-accent/5 rounded-lg flex items-center justify-center mb-4 border border-accent/30">
              <stat.icon className="h-8 w-8 text-accent" />
            </div>
            <div className="mb-2 text-accent drop-shadow-[0_0_8px_rgba(240,185,11,0.3)]">
              <span className="font-bold text-2xl md:text-3xl">
                <AnimatedCounter 
                  end={parseInt(stat.value)} 
                  prefix={stat.suffix === "$" ? "$" : ""} 
                  suffix={stat.suffix !== "$" ? stat.suffix : ""} 
                />
              </span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Desktop: 4-column grid */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-8">
        {stats.map((stat, index) => (
          <div key={index} className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-accent/20 to-accent/5 rounded-lg flex items-center justify-center mb-4 border border-accent/30">
              <stat.icon className="h-8 w-8 text-accent" />
            </div>
            <div className="mb-2 text-accent drop-shadow-[0_0_8px_rgba(240,185,11,0.3)]">
              <span className="font-bold text-2xl md:text-3xl">
                <AnimatedCounter 
                  end={parseInt(stat.value)} 
                  prefix={stat.suffix === "$" ? "$" : ""} 
                  suffix={stat.suffix !== "$" ? stat.suffix : ""} 
                />
              </span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
          </div>
        ))}
      </div>
    </>
  );
};