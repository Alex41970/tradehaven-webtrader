import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Users, ArrowRight, BarChart3, Globe, Award, CheckCircle, Star, Quote } from "lucide-react";
import { MarketTicker } from "@/components/MarketTicker";
import { HeroChart } from "@/components/HeroChart";
import { TradingStats } from "@/components/TradingStats";
import { TrustBadges } from "@/components/TrustBadges";
import { Footer } from "@/components/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Logo } from "@/components/Logo";

const demoRequestSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }).max(255, { message: "Email must be less than 255 characters" }),
  name: z.string().trim().nonempty({ message: "Name cannot be empty" }).max(100, { message: "Name must be less than 100 characters" }),
});

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<{ email?: string; name?: string }>({});
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleDemoRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const result = demoRequestSchema.safeParse({ email, name });
    
    if (!result.success) {
      const fieldErrors: { email?: string; name?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as 'email' | 'name'] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast({
        title: "Demo Account Request Submitted!",
        description: `We'll send demo account details to ${email} shortly.`,
      });
      
      setEmail("");
      setName("");
      setIsDemoModalOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-trading-dark overflow-x-hidden">
      {/* Market Ticker */}
      <MarketTicker />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-secondary border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Logo size="md" className="lg:hidden hover:scale-105 transition-transform" />
          <Logo size="lg" className="hidden lg:block hover:scale-105 transition-transform" />
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="hidden md:flex" onClick={() => navigate("/markets")}>
              Markets
            </Button>
            <Button variant="ghost" className="hidden md:flex" onClick={() => navigate("/education")}>
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
      <section className="relative py-16 lg:py-24 bg-subtle-grid">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-left w-full max-w-full">
              <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-lg text-sm font-semibold mb-6 border border-accent/20">
                <Award className="h-4 w-4" />
                Best Trading Platform 2024
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-6xl font-bold mb-6 leading-tight text-foreground break-words">
                <span className="block">Trade Global</span>
                <span className="block text-accent mt-1">Markets 24/7</span>
              </h1>
              {/* Mobile version - short and focused */}
              <p className="text-base md:hidden text-foreground/80 mb-8 leading-relaxed max-w-full break-words">
                Professional trading platform with 10,000+ instruments. Forex, stocks, crypto, and more.
              </p>
              {/* Desktop version - more detail */}
              <p className="hidden md:block text-lg lg:text-xl text-foreground/80 mb-8 max-w-xl leading-relaxed break-words">
                Access global markets with institutional-grade tools. Trade forex, stocks, commodities, and cryptocurrencies on a single platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-8 md:mb-12 w-full max-w-full">
                <Button size="lg" variant="trading" onClick={() => navigate("/auth")} className="w-full sm:w-auto whitespace-nowrap">
                  Start Trading Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="trading-outline" 
                  onClick={() => setIsDemoModalOpen(true)}
                  className="w-full sm:w-auto whitespace-nowrap"
                >
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
      <section className="py-20 bg-section-alt">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-foreground">
              Why Choose Our Platform
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Professional-grade tools trusted by traders worldwide
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            <div className="p-6 bg-gradient-to-br from-green-500/5 to-transparent rounded-lg border-2 border-border/50 hover:border-green-500/50 transition-all duration-300">
              <div className="h-14 w-14 bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-xl flex items-center justify-center mb-4 border border-green-500/30">
                <Shield className="h-7 w-7 text-trading-success" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Regulated & Secure</h3>
              <p className="text-muted-foreground mb-4">
                FCA licensed with segregated funds and 256-bit SSL encryption protecting your investments
              </p>
              <div className="text-sm text-trading-success font-medium">Funds up to £85,000 protected</div>
            </div>

            <div className="p-6 bg-gradient-to-br from-accent/5 to-transparent rounded-lg border-2 border-border/50 hover:border-accent/50 transition-all duration-300">
              <div className="h-14 w-14 bg-gradient-to-br from-accent/20 to-accent/5 rounded-xl flex items-center justify-center mb-4 border border-accent/30">
                <Zap className="h-7 w-7 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Ultra-Fast Execution</h3>
              <p className="text-muted-foreground mb-4">
                Execute trades in milliseconds with our advanced matching engine and zero slippage
              </p>
              <div className="text-sm text-accent font-medium">Average execution: 0.03 seconds</div>
            </div>

            <div className="p-6 bg-gradient-to-br from-primary/10 to-transparent rounded-lg border-2 border-border/50 hover:border-primary/50 transition-all duration-300">
              <div className="h-14 w-14 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center mb-4 border border-primary/30">
                <BarChart3 className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Advanced Analytics</h3>
              <p className="text-muted-foreground mb-4">
                Professional charting tools, technical indicators, and AI-powered market insights
              </p>
              <div className="text-sm text-primary font-medium">100+ technical indicators</div>
            </div>

            <div className="p-6 bg-gradient-to-br from-green-500/5 to-transparent rounded-lg border-2 border-border/50 hover:border-green-500/50 transition-all duration-300">
              <div className="h-14 w-14 bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-xl flex items-center justify-center mb-4 border border-green-500/30">
                <Globe className="h-7 w-7 text-trading-success" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Global Markets</h3>
              <p className="text-muted-foreground mb-4">
                Trade forex, stocks, indices, commodities, and crypto from a single platform
              </p>
              <div className="text-sm text-trading-success font-medium">10,000+ instruments available</div>
            </div>

            <div className="p-6 bg-gradient-to-br from-accent/5 to-transparent rounded-lg border-2 border-border/50 hover:border-accent/50 transition-all duration-300">
              <div className="h-14 w-14 bg-gradient-to-br from-accent/20 to-accent/5 rounded-xl flex items-center justify-center mb-4 border border-accent/30">
                <Users className="h-7 w-7 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">24/7 Expert Support</h3>
              <p className="text-muted-foreground mb-4">
                Get help from our multilingual support team and access premium educational content
              </p>
              <div className="text-sm text-accent font-medium">Available in 25 languages</div>
            </div>

            <div className="p-6 bg-gradient-to-br from-primary/10 to-transparent rounded-lg border-2 border-border/50 hover:border-primary/50 transition-all duration-300">
              <div className="h-14 w-14 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center mb-4 border border-primary/30">
                <Award className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Award Winning</h3>
              <p className="text-muted-foreground mb-4">
                Recognized as the best trading platform with multiple industry awards and certifications
              </p>
              <div className="text-sm text-primary font-medium">15+ industry awards</div>
            </div>
          </div>

          <TrustBadges />
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-20 bg-secondary relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none"></div>
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-foreground">Trusted Globally</h2>
            <p className="text-xl text-muted-foreground">Join a worldwide community of successful traders</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-card to-card/50 rounded-lg border-2 border-card-border hover:border-accent/50 transition-all duration-300">
              <div className="text-4xl lg:text-5xl font-bold text-accent mb-2 drop-shadow-[0_0_12px_rgba(240,185,11,0.3)]">500K+</div>
              <div className="text-muted-foreground font-medium">Active Traders</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-card to-card/50 rounded-lg border-2 border-card-border hover:border-trading-success/50 transition-all duration-300">
              <div className="text-4xl lg:text-5xl font-bold text-trading-success mb-2 drop-shadow-[0_0_12px_rgba(14,203,129,0.3)]">$50B+</div>
              <div className="text-muted-foreground font-medium">Monthly Volume</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-card to-card/50 rounded-lg border-2 border-card-border hover:border-primary/50 transition-all duration-300">
              <div className="text-4xl lg:text-5xl font-bold text-primary mb-2 drop-shadow-[0_0_12px_rgba(56,97,251,0.3)]">10K+</div>
              <div className="text-muted-foreground font-medium">Instruments</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-card to-card/50 rounded-lg border-2 border-card-border hover:border-accent/50 transition-all duration-300">
              <div className="text-4xl lg:text-5xl font-bold text-accent mb-2 drop-shadow-[0_0_12px_rgba(240,185,11,0.3)]">0.03s</div>
              <div className="text-muted-foreground font-medium">Avg Execution</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-section-alt">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-foreground">Start Trading in 3 Steps</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes and access global markets
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex h-16 w-16 bg-primary rounded-lg items-center justify-center mb-6">
                <span className="text-3xl font-bold text-primary-foreground">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Create Account</h3>
              <p className="text-muted-foreground">
                Sign up in minutes with just your email. Complete our simple verification process.
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex h-16 w-16 bg-accent rounded-lg items-center justify-center mb-6">
                <span className="text-3xl font-bold text-accent-foreground">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Fund Account</h3>
              <p className="text-muted-foreground">
                Deposit funds securely using your preferred payment method. Start with as little as $100.
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex h-16 w-16 bg-trading-success rounded-lg items-center justify-center mb-6">
                <span className="text-3xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Start Trading</h3>
              <p className="text-muted-foreground">
                Access 10,000+ instruments and start trading with professional-grade tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-foreground">What Traders Say</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Real feedback from real traders
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-card rounded-lg border border-border">
              <Quote className="h-10 w-10 text-accent mb-4 opacity-50" />
              <p className="text-muted-foreground mb-6">
                "Best trading platform I've used. The execution speed is incredible and the interface is intuitive."
              </p>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                  JD
                </div>
                <div>
                  <div className="font-semibold text-foreground">James Davidson</div>
                  <div className="text-sm text-muted-foreground">Day Trader</div>
                </div>
              </div>
              <div className="flex gap-1 mt-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>
            </div>

            <div className="p-6 bg-card rounded-lg border border-border">
              <Quote className="h-10 w-10 text-accent mb-4 opacity-50" />
              <p className="text-muted-foreground mb-6">
                "The analytics tools are professional-grade. I've significantly improved my trading performance."
              </p>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-semibold">
                  SC
                </div>
                <div>
                  <div className="font-semibold text-foreground">Sarah Chen</div>
                  <div className="text-sm text-muted-foreground">Forex Trader</div>
                </div>
              </div>
              <div className="flex gap-1 mt-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>
            </div>

            <div className="p-6 bg-card rounded-lg border border-border">
              <Quote className="h-10 w-10 text-accent mb-4 opacity-50" />
              <p className="text-muted-foreground mb-6">
                "Customer support is outstanding. They helped me set up my account and answered all my questions."
              </p>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-trading-success flex items-center justify-center text-white font-semibold">
                  MR
                </div>
                <div>
                  <div className="font-semibold text-foreground">Michael Rodriguez</div>
                  <div className="text-sm text-muted-foreground">Stock Trader</div>
                </div>
              </div>
              <div className="flex gap-1 mt-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-foreground">Frequently Asked Questions</h2>
            <p className="text-xl text-muted-foreground">Find answers to common questions</p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-border">
              <AccordionTrigger className="text-left text-foreground hover:text-primary">
                What is the minimum deposit required?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The minimum deposit is just $100. You can start trading with a small amount and scale up as you gain confidence.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border-border">
              <AccordionTrigger className="text-left text-foreground hover:text-primary">
                Is my money safe and secure?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes, we are FCA regulated and your funds are held in segregated accounts. We use 256-bit SSL encryption and funds are protected up to £85,000.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="border-border">
              <AccordionTrigger className="text-left text-foreground hover:text-primary">
                What markets can I trade?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                You can trade forex, stocks, indices, commodities, and cryptocurrencies. We offer over 10,000 instruments across all major markets.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4" className="border-border">
              <AccordionTrigger className="text-left text-foreground hover:text-primary">
                Can I try the platform before depositing?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes! We offer a free demo account with virtual funds so you can practice trading without any risk.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5" className="border-border">
              <AccordionTrigger className="text-left text-foreground hover:text-primary">
                What are your trading fees?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                We offer competitive spreads starting from 0.1 pips on major currency pairs. There are no hidden fees or commissions on most accounts.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-secondary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-5xl font-bold mb-6 text-foreground">
            Ready to Start Trading?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of traders who trust our platform for their trading needs
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="trading" onClick={() => navigate("/auth")}>
              Create Free Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="trading-outline" onClick={() => setIsDemoModalOpen(true)}>
              Try Demo First
            </Button>
          </div>
        </div>
      </section>

      <Footer />

      {/* Demo Request Modal */}
      <Dialog open={isDemoModalOpen} onOpenChange={setIsDemoModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Request Demo Account</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter your details and we'll set up a demo account for you with $100,000 virtual funds.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDemoRequest} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-foreground">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-destructive text-sm mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
            </div>
            <Button type="submit" className="w-full" variant="trading" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Request Demo Account"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;