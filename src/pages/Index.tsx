import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { TrendingUp, Shield, Zap, Users, ArrowRight, BarChart3, Globe, Award } from "lucide-react";
import { MarketTicker } from "@/components/MarketTicker";
import { HeroChart } from "@/components/HeroChart";
import { TradingStats } from "@/components/TradingStats";
import { TrustBadges } from "@/components/TrustBadges";

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-trading-pattern">
      {/* Market Ticker */}
      <MarketTicker />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="h-10 w-10 bg-gradient-to-br from-trading-primary to-trading-accent rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-trading-primary to-trading-accent bg-clip-text text-transparent">
              <span className="hidden md:inline">Lexington Capital Investing</span>
              <span className="md:hidden">LCI</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="hidden md:flex">
              Markets
            </Button>
            <Button variant="ghost" className="hidden md:flex">
              Education
            </Button>
            <Button variant="trading" onClick={() => navigate("/auth")}>
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-chart-lines opacity-30"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-trading-primary/10 via-transparent to-trading-accent/10"></div>
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-left">
              <div className="inline-flex items-center gap-2 bg-trading-accent/10 text-trading-accent px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Award className="h-4 w-4" />
                Best Trading Platform 2024
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
                Trade the
                <span className="bg-gradient-to-r from-trading-primary to-trading-accent bg-clip-text text-transparent">
                  {" "}Global Markets
                </span>
                <br />with Confidence
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-xl">
                Access 10,000+ instruments across forex, stocks, commodities, and crypto. 
                Join 500,000+ traders who trust our advanced platform for their success.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Button size="lg" variant="trading" onClick={() => navigate("/auth")} className="text-lg px-8 py-6">
                  Start Trading Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="trading-outline" className="text-lg px-8 py-6">
                  Try Demo Account
                </Button>
              </div>
              <TradingStats />
            </div>
            <div className="hidden lg:block">
              <HeroChart />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gradient-to-b from-transparent to-muted/20 relative">
        <div className="absolute inset-0 bg-chart-lines opacity-10"></div>
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Why <span className="text-trading-accent">500,000+</span> Traders Choose Us
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience the difference with our award-winning platform and professional-grade tools
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <div className="group p-8 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 hover:bg-card/80 transition-all duration-300 hover:shadow-xl hover:shadow-trading-accent/10">
              <div className="h-14 w-14 bg-gradient-to-br from-trading-success/20 to-trading-success/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Shield className="h-7 w-7 text-trading-success" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Regulated & Secure</h3>
              <p className="text-muted-foreground mb-4">
                FCA licensed with segregated funds and 256-bit SSL encryption protecting your investments
              </p>
              <div className="text-sm text-trading-success font-medium">Funds up to £85,000 protected</div>
            </div>

            <div className="group p-8 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 hover:bg-card/80 transition-all duration-300 hover:shadow-xl hover:shadow-trading-accent/10">
              <div className="h-14 w-14 bg-gradient-to-br from-trading-accent/20 to-trading-accent/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Zap className="h-7 w-7 text-trading-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Ultra-Fast Execution</h3>
              <p className="text-muted-foreground mb-4">
                Execute trades in milliseconds with our advanced matching engine and zero slippage
              </p>
              <div className="text-sm text-trading-accent font-medium">Average execution: 0.03 seconds</div>
            </div>

            <div className="group p-8 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 hover:bg-card/80 transition-all duration-300 hover:shadow-xl hover:shadow-trading-accent/10">
              <div className="h-14 w-14 bg-gradient-to-br from-trading-primary/20 to-trading-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="h-7 w-7 text-trading-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Advanced Analytics</h3>
              <p className="text-muted-foreground mb-4">
                Professional charting tools, technical indicators, and AI-powered market insights
              </p>
              <div className="text-sm text-trading-primary font-medium">100+ technical indicators</div>
            </div>

            <div className="group p-8 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 hover:bg-card/80 transition-all duration-300 hover:shadow-xl hover:shadow-trading-accent/10">
              <div className="h-14 w-14 bg-gradient-to-br from-trading-success/20 to-trading-success/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Globe className="h-7 w-7 text-trading-success" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Global Markets</h3>
              <p className="text-muted-foreground mb-4">
                Trade forex, stocks, indices, commodities, and crypto from a single platform
              </p>
              <div className="text-sm text-trading-success font-medium">10,000+ instruments available</div>
            </div>

            <div className="group p-8 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 hover:bg-card/80 transition-all duration-300 hover:shadow-xl hover:shadow-trading-accent/10">
              <div className="h-14 w-14 bg-gradient-to-br from-trading-accent/20 to-trading-accent/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-7 w-7 text-trading-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">24/7 Expert Support</h3>
              <p className="text-muted-foreground mb-4">
                Get help from our multilingual support team and access premium educational content
              </p>
              <div className="text-sm text-trading-accent font-medium">Available in 25 languages</div>
            </div>

            <div className="group p-8 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 hover:bg-card/80 transition-all duration-300 hover:shadow-xl hover:shadow-trading-accent/10">
              <div className="h-14 w-14 bg-gradient-to-br from-trading-primary/20 to-trading-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Award className="h-7 w-7 text-trading-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Award Winning</h3>
              <p className="text-muted-foreground mb-4">
                Recognized as the best trading platform with multiple industry awards and certifications
              </p>
              <div className="text-sm text-trading-primary font-medium">15+ industry awards</div>
            </div>
          </div>

          <TrustBadges />
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-trading-primary via-trading-secondary to-trading-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]"></div>
        <div className="container mx-auto px-4 text-center relative">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Ready to Join the Elite Trading Community?
          </h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Start with a free demo account or go live with as little as $100. 
            No hidden fees, no commitments.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" onClick={() => navigate("/auth")} className="text-lg px-8 py-6 bg-white text-trading-primary hover:bg-white/90">
              Create Free Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-white text-white hover:bg-white hover:text-trading-primary">
              Try Demo First
            </Button>
          </div>
          <p className="text-sm text-white/60 mt-6">
            Risk warning: Trading involves risk of loss. 76% of retail accounts lose money.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Index;
