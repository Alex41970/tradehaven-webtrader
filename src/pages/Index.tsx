import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { TrendingUp, Shield, Zap, Users, ArrowRight, BarChart3, Globe, Award, CheckCircle, Star, Quote } from "lucide-react";
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
      // Simulate API call
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
    <div className="min-h-screen bg-chart-depth bg-fixed-parallax">
      {/* Market Ticker */}
      <div className="bg-gradient-to-r from-card/50 via-card/60 to-card/50 backdrop-blur-md border-b border-trading-accent/20 shadow-lg shadow-trading-accent/5">
        <MarketTicker />
      </div>

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
      <section className="relative py-20 lg:py-32 overflow-hidden">
        {/* Dark overlay for text contrast */}
        <div className="absolute inset-0 content-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent"></div>
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-left">
              <div className="inline-flex items-center gap-2 bg-trading-accent/10 text-trading-accent px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Award className="h-4 w-4" />
                Best Trading Platform 2024
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight drop-shadow-2xl">
                Trade the
                <span className="bg-gradient-to-r from-trading-primary via-trading-accent to-trading-primary bg-clip-text text-transparent animate-glow-pulse">
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
                <Button 
                  size="lg" 
                  variant="trading-outline" 
                  className="text-lg px-8 py-6"
                  onClick={() => setIsDemoModalOpen(true)}
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
            <div className="group p-8 bg-card/80 backdrop-blur-md rounded-xl border border-border/50 hover:border-trading-accent/50 transition-all duration-300 hover:shadow-2xl hover:shadow-trading-accent/20 hover:scale-105 hover-shine">
              <div className="h-14 w-14 bg-gradient-to-br from-trading-success/20 to-trading-success/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Shield className="h-7 w-7 text-trading-success" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Regulated & Secure</h3>
              <p className="text-muted-foreground mb-4">
                FCA licensed with segregated funds and 256-bit SSL encryption protecting your investments
              </p>
              <div className="text-sm text-trading-success font-medium">Funds up to £85,000 protected</div>
            </div>

            <div className="group p-8 bg-card/80 backdrop-blur-md rounded-xl border border-border/50 hover:border-trading-accent/50 transition-all duration-300 hover:shadow-2xl hover:shadow-trading-accent/20 hover:scale-105 hover-shine">
              <div className="h-14 w-14 bg-gradient-to-br from-trading-accent/20 to-trading-accent/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Zap className="h-7 w-7 text-trading-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Ultra-Fast Execution</h3>
              <p className="text-muted-foreground mb-4">
                Execute trades in milliseconds with our advanced matching engine and zero slippage
              </p>
              <div className="text-sm text-trading-accent font-medium">Average execution: 0.03 seconds</div>
            </div>

            <div className="group p-8 bg-card/80 backdrop-blur-md rounded-xl border border-border/50 hover:border-trading-accent/50 transition-all duration-300 hover:shadow-2xl hover:shadow-trading-accent/20 hover:scale-105 hover-shine">
              <div className="h-14 w-14 bg-gradient-to-br from-trading-primary/20 to-trading-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="h-7 w-7 text-trading-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Advanced Analytics</h3>
              <p className="text-muted-foreground mb-4">
                Professional charting tools, technical indicators, and AI-powered market insights
              </p>
              <div className="text-sm text-trading-primary font-medium">100+ technical indicators</div>
            </div>

            <div className="group p-8 bg-card/80 backdrop-blur-md rounded-xl border border-border/50 hover:border-trading-accent/50 transition-all duration-300 hover:shadow-2xl hover:shadow-trading-accent/20 hover:scale-105 hover-shine">
              <div className="h-14 w-14 bg-gradient-to-br from-trading-success/20 to-trading-success/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Globe className="h-7 w-7 text-trading-success" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Global Markets</h3>
              <p className="text-muted-foreground mb-4">
                Trade forex, stocks, indices, commodities, and crypto from a single platform
              </p>
              <div className="text-sm text-trading-success font-medium">10,000+ instruments available</div>
            </div>

            <div className="group p-8 bg-card/80 backdrop-blur-md rounded-xl border border-border/50 hover:border-trading-accent/50 transition-all duration-300 hover:shadow-2xl hover:shadow-trading-accent/20 hover:scale-105 hover-shine">
              <div className="h-14 w-14 bg-gradient-to-br from-trading-accent/20 to-trading-accent/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-7 w-7 text-trading-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">24/7 Expert Support</h3>
              <p className="text-muted-foreground mb-4">
                Get help from our multilingual support team and access premium educational content
              </p>
              <div className="text-sm text-trading-accent font-medium">Available in 25 languages</div>
            </div>

            <div className="group p-8 bg-card/80 backdrop-blur-md rounded-xl border border-border/50 hover:border-trading-accent/50 transition-all duration-300 hover:shadow-2xl hover:shadow-trading-accent/20 hover:scale-105 hover-shine">
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

      {/* Statistics Section */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-b from-transparent via-card/20 to-transparent">
        <div className="absolute inset-0 bg-gradient-to-r from-trading-primary/5 via-transparent to-trading-accent/5"></div>
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Trusted by Traders Worldwide</h2>
            <p className="text-xl text-muted-foreground">Join a global community of successful traders</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center p-6 bg-card/30 backdrop-blur-sm rounded-xl border border-border/50">
              <div className="text-4xl lg:text-5xl font-bold text-trading-accent mb-2">500K+</div>
              <div className="text-muted-foreground">Active Traders</div>
            </div>
            <div className="text-center p-6 bg-card/30 backdrop-blur-sm rounded-xl border border-border/50">
              <div className="text-4xl lg:text-5xl font-bold text-trading-success mb-2">$50B+</div>
              <div className="text-muted-foreground">Monthly Volume</div>
            </div>
            <div className="text-center p-6 bg-card/30 backdrop-blur-sm rounded-xl border border-border/50">
              <div className="text-4xl lg:text-5xl font-bold text-trading-primary mb-2">10K+</div>
              <div className="text-muted-foreground">Instruments</div>
            </div>
            <div className="text-center p-6 bg-card/30 backdrop-blur-sm rounded-xl border border-border/50">
              <div className="text-4xl lg:text-5xl font-bold text-trading-accent mb-2">0.03s</div>
              <div className="text-muted-foreground">Avg Execution</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gradient-to-b from-card/30 via-card/20 to-transparent backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Start Trading in 3 Simple Steps</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes and access global markets instantly
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative">
              <div className="text-center">
                <div className="inline-flex h-16 w-16 bg-gradient-to-br from-trading-primary to-trading-accent rounded-full items-center justify-center mb-6">
                  <span className="text-3xl font-bold text-white">1</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Create Your Account</h3>
                <p className="text-muted-foreground">
                  Sign up in minutes with just your email. Complete our simple verification process to ensure your account security.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="text-center">
                <div className="inline-flex h-16 w-16 bg-gradient-to-br from-trading-accent to-trading-success rounded-full items-center justify-center mb-6">
                  <span className="text-3xl font-bold text-white">2</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Fund Your Account</h3>
                <p className="text-muted-foreground">
                  Deposit funds securely using your preferred payment method. Start with as little as $100, no hidden fees.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="text-center">
                <div className="inline-flex h-16 w-16 bg-gradient-to-br from-trading-success to-trading-primary rounded-full items-center justify-center mb-6">
                  <span className="text-3xl font-bold text-white">3</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Start Trading</h3>
                <p className="text-muted-foreground">
                  Access 10,000+ instruments and start trading with our professional-grade platform and tools.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-chart-lines opacity-10"></div>
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">What Our Traders Say</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Real feedback from real traders
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
              <Quote className="h-10 w-10 text-trading-accent mb-4 opacity-50" />
              <p className="text-muted-foreground mb-6">
                "Best trading platform I've used. The execution speed is incredible and the interface is so intuitive. Made my first profitable trade within hours!"
              </p>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-trading-primary to-trading-accent flex items-center justify-center text-white font-semibold">
                  JD
                </div>
                <div>
                  <div className="font-semibold">James Davidson</div>
                  <div className="text-sm text-muted-foreground">Day Trader</div>
                </div>
              </div>
              <div className="flex gap-1 mt-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-trading-accent text-trading-accent" />
                ))}
              </div>
            </div>
            <div className="p-8 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
              <Quote className="h-10 w-10 text-trading-accent mb-4 opacity-50" />
              <p className="text-muted-foreground mb-6">
                "Professional-grade tools at an affordable price. The analytics and charting capabilities have transformed my trading strategy completely."
              </p>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-trading-accent to-trading-success flex items-center justify-center text-white font-semibold">
                  SC
                </div>
                <div>
                  <div className="font-semibold">Sarah Chen</div>
                  <div className="text-sm text-muted-foreground">Forex Trader</div>
                </div>
              </div>
              <div className="flex gap-1 mt-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-trading-accent text-trading-accent" />
                ))}
              </div>
            </div>
            <div className="p-8 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
              <Quote className="h-10 w-10 text-trading-accent mb-4 opacity-50" />
              <p className="text-muted-foreground mb-6">
                "Customer support is outstanding. They helped me set up my account and answered all my questions. Highly recommended for beginners and pros alike."
              </p>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-trading-success to-trading-primary flex items-center justify-center text-white font-semibold">
                  MP
                </div>
                <div>
                  <div className="font-semibold">Michael Peters</div>
                  <div className="text-sm text-muted-foreground">Crypto Trader</div>
                </div>
              </div>
              <div className="flex gap-1 mt-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-trading-accent text-trading-accent" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to know about trading with us
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem value="item-1" className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 px-6">
              <AccordionTrigger className="text-left">Is my money safe with Lexington Capital Investing?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Absolutely. We are fully regulated by the FCA and your funds are held in segregated accounts with tier-1 banks. 
                We also provide investor protection up to £85,000 and use 256-bit SSL encryption for all transactions.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 px-6">
              <AccordionTrigger className="text-left">What is the minimum deposit required?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                You can start trading with as little as $100. We believe in making trading accessible to everyone, 
                regardless of their capital size. There are no hidden fees or minimum balance requirements.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 px-6">
              <AccordionTrigger className="text-left">Can I try the platform before depositing real money?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes! We offer a free demo account with $10,000 in virtual funds. You can test all features, 
                practice your strategies, and get comfortable with the platform before committing real capital.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4" className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 px-6">
              <AccordionTrigger className="text-left">How long do withdrawals take?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Withdrawal requests are typically processed within 24 hours. The time to receive funds in your account 
                depends on your payment method: bank transfers take 1-3 business days, while e-wallets are usually instant.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5" className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 px-6">
              <AccordionTrigger className="text-left">What trading instruments are available?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                We offer over 10,000 instruments including Forex (70+ currency pairs), Stocks (global exchanges), 
                Commodities (gold, silver, oil), Cryptocurrencies (Bitcoin, Ethereum, and more), and Indices 
                (S&P 500, FTSE 100, DAX, etc.).
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-6" className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 px-6">
              <AccordionTrigger className="text-left">Do you offer educational resources for beginners?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes! We provide comprehensive educational materials including video tutorials, webinars, trading guides, 
                market analysis, and a glossary of trading terms. Our 24/7 support team is also available to help you learn.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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

      {/* Demo Account Request Modal */}
      <Dialog open={isDemoModalOpen} onOpenChange={setIsDemoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Free Demo Account</DialogTitle>
            <DialogDescription>
              Enter your details to receive demo account access with $100,000 virtual money
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDemoRequest} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="demo-name">Full Name</Label>
              <Input
                id="demo-name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-email">Email Address</Label>
              <Input
                id="demo-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email}</p>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDemoModalOpen(false)}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="trading"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Submitting..." : "Request Demo Account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;
