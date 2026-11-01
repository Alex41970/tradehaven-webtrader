import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Shield, Zap, ArrowRight, BarChart3, Globe } from "lucide-react";
import { MarketTicker } from "@/components/MarketTicker";
import { HeroChart } from "@/components/HeroChart";
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

  const features = [
    { icon: BarChart3, title: "Real charts", text: "Candles from our own price feed with Bollinger Bands, moving averages, RSI and MACD.", span: "md:col-span-2" },
    { icon: Zap, title: "Fast prices", text: "Crypto refreshes every 15 seconds, all other markets within a minute.", span: "" },
    { icon: Shield, title: "Clear risk", text: "Margin, free margin and margin level always visible. Stop-loss and take-profit run on the server.", span: "" },
    { icon: Globe, title: "395 markets", text: "Crypto, forex, US and European stocks, indices and commodities in one place.", span: "md:col-span-2" },
  ];
  const steps = [
    ["Create an account", "Sign up with your email and your promo code."],
    ["Fund it", "Request a deposit from your dashboard."],
    ["Trade", "Pick a market, set your size and go."],
  ];

  return (
    <div className="min-h-screen bg-background">
      <MarketTicker />

      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo size="md" />
          <nav className="flex items-center gap-1">
            <Button variant="ghost" className="hidden md:inline-flex" onClick={() => navigate("/markets")}>Markets</Button>
            <Button variant="ghost" className="hidden md:inline-flex" onClick={() => navigate("/education")}>Education</Button>
            <Button variant="ghost" onClick={() => navigate("/auth")}>Sign in</Button>
            <Button onClick={() => navigate("/auth")}>Get started<ArrowRight className="ml-1 h-4 w-4" /></Button>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-subtle-grid opacity-50" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="container relative mx-auto grid items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div className="min-w-0">
            <span className="label-caps inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />Live prices
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-6xl">
              Trade global markets<br /><span className="text-primary">from one screen.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Forex, stocks, crypto, indices and commodities with live charts and risk numbers you can actually read.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={() => navigate("/auth")}>Start trading<ArrowRight className="ml-2 h-5 w-5" /></Button>
              <Button size="lg" variant="outline" onClick={() => setIsDemoModalOpen(true)}>Request a demo</Button>
            </div>
          </div>
          <div className="bento hidden p-4 lg:block"><HeroChart /></div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <div className="mb-10 max-w-2xl">
          <p className="label-caps text-primary">Platform</p>
          <h2 className="mt-2 text-3xl font-semibold text-foreground md:text-4xl">Built for focus, not noise.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className={`bento p-6 ${f.span}`}>
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></div>
              <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-sidebar">
        <div className="container mx-auto grid gap-8 px-4 py-20 md:grid-cols-3">
          {steps.map(([t, d], i) => (
            <div key={t}>
              <div className="num text-sm text-primary">0{i + 1}</div>
              <h3 className="mt-3 text-xl font-semibold text-foreground">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto max-w-3xl px-4 py-20">
        <h2 className="mb-8 text-3xl font-semibold text-foreground">Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {[
            ["What markets can I trade?", "Crypto, forex, US and European stocks, indices and commodities — 395 markets in total."],
            ["Where do prices come from?", "Our own price feed collects real market prices around the clock. Charts use the same prices you trade at."],
            ["How do I sign up?", "Create an account with your email and the promo code you got from your account manager."],
            ["Can I try it first?", "Yes, request a demo and we'll get in touch."],
          ].map(([q, a], i) => (
            <AccordionItem key={q} value={`q${i}`} className="border-border">
              <AccordionTrigger className="text-left text-foreground hover:text-primary">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="container mx-auto px-4 pb-20">
        <div className="bento relative overflow-hidden p-10 text-center md:p-16">
          <div className="pointer-events-none absolute inset-0 bg-subtle-grid opacity-40" />
          <h2 className="relative text-3xl font-semibold text-foreground md:text-4xl">Ready when you are.</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-muted-foreground">Open your account in a couple of minutes.</p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => navigate("/auth")}>Create account<ArrowRight className="ml-2 h-5 w-5" /></Button>
            <Button size="lg" variant="outline" onClick={() => setIsDemoModalOpen(true)}>Request a demo</Button>
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Request Demo Account"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;