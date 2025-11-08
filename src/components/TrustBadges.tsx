import { Shield, Award, Lock, Globe } from "lucide-react";

const badges = [
  {
    icon: Shield,
    title: "FCA Regulated",
    description: "Licensed & Regulated by Financial Conduct Authority"
  },
  {
    icon: Lock,
    title: "Secure Trading",
    description: "256-bit SSL encryption & segregated funds"
  },
  {
    icon: Award,
    title: "Award Winning",
    description: "Best Investment Platform 2024"
  },
  {
    icon: Globe,
    title: "Global Reach",
    description: "Serving traders in 180+ countries"
  }
];

export const TrustBadges = () => {
  return (
    <div className="bg-card rounded-lg p-6 md:p-8 border border-border">
      <h3 className="text-2xl font-bold text-center mb-8">Trusted by Traders Worldwide</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {badges.map((badge, index) => (
          <div key={index} className="text-center group">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3 border border-primary/20 transition-all duration-300 group-hover:bg-primary/20 group-hover:border-primary/40">
              <badge.icon className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-semibold mb-2 text-foreground">{badge.title}</h4>
            <p className="text-sm text-muted-foreground">{badge.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};