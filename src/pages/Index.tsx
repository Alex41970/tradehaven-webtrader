import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAssets } from "@/hooks/useAssets";
import { Button } from "@/components/ui/button";
import {
  Shield, Zap, ArrowRight, BarChart3, Globe, LineChart, Smartphone, Lock, Headphones,
  Bitcoin, DollarSign, Building2, Gem, TrendingUp, TrendingDown, Check, Activity, Layers,
} from "lucide-react";
import { MarketTicker } from "@/components/MarketTicker";
import { HeroChart } from "@/components/HeroChart";
import { Footer } from "@/components/Footer";
import { PublicHeader } from "@/components/PublicHeader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import heroImg from "@/assets/hero-markets.jpg";
import devicesImg from "@/assets/devices-trading.jpg";

const demoRequestSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }).max(255),
  name: z.string().trim().nonempty({ message: "Name cannot be empty" }).max(100),
});

const CATS = [
  { key: "crypto", label: "Crypto", match: ["crypto"] },
  { key: "forex", label: "Forex", match: ["forex"] },
  { key: "stocks", label: "Stocks", match: ["stock", "stocks"] },
  { key: "indices", label: "Indices", match: ["index", "indices"] },
  { key: "commodities", label: "Commodities", match: ["commodity", "commodities"] },
];

const fmtPrice = (p: number) =>
  p >= 1000 ? p.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p >= 10 ? p.toFixed(2) : p.toFixed(p < 2 ? 5 : 4);

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { assets } = useAssets();
  const [cat, setCat] = useState("crypto");
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<{ email?: string; name?: string }>({});
  const { toast } = useToast();

  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    CATS.forEach((k) => (c[k.key] = assets.filter((a) => k.match.includes(a.category)).length));
    return c;
  }, [assets]);

  const rows = useMemo(() => {
    const m = CATS.find((c) => c.key === cat)!.match;
    return assets.filter((a) => m.includes(a.category)).sort((a, b) => Math.abs(b.change_24h) - Math.abs(a.change_24h)).slice(0, 8);
  }, [assets, cat]);

  const total = assets.length || 395;

  const handleDemoRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = demoRequestSchema.safeParse({ email, name });
    if (!result.success) {
      const fe: { email?: string; name?: string } = {};
      result.error.errors.forEach((err) => { if (err.path[0]) fe[err.path[0] as "email" | "name"] = err.message; });
      setErrors(fe);
      return;
    }
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    toast({ title: "Request received", description: `We'll contact you at ${email}.` });
    setEmail(""); setName(""); setIsDemoModalOpen(false); setIsSubmitting(false);
  };

  const classes = [
    { icon: Bitcoin, key: "crypto", title: "Crypto", text: "Bitcoin, Ethereum, Solana and 100+ coins, open 24/7." },
    { icon: DollarSign, key: "forex", title: "Forex", text: "Majors, minors and exotics with tight spreads." },
    { icon: Building2, key: "stocks", title: "Stocks", text: "US and European blue chips like Apple, Tesla, SAP." },
    { icon: BarChart3, key: "indices", title: "Indices", text: "S&P 500, Nasdaq, DAX, FTSE and more." },
    { icon: Gem, key: "commodities", title: "Commodities", text: "Gold, silver, oil, gas and agriculture." },
  ];

  const features = [
    { icon: LineChart, title: "Pro charts, built in", text: "Candles, bars, line or area. Bollinger Bands, SMA, EMA, RSI and MACD — on the same prices you trade.", span: "md:col-span-2 md:row-span-2", big: true },
    { icon: Zap, title: "Fast prices", text: "Crypto refreshes every 15 seconds, other markets within a minute." },
    { icon: Shield, title: "Server-side protection", text: "Stop-loss, take-profit and stop-out run on our servers, even when you're offline." },
    { icon: Activity, title: "Live risk numbers", text: "Equity, margin, free margin and margin level update with every tick." },
    { icon: Smartphone, title: "Any device", text: "Full trading on desktop, tablet and phone — no download needed." },
  ];

  const steps = [
    { t: "Create your account", d: "Sign up with your email and the promo code from your account manager." },
    { t: "Fund your account", d: "Request a deposit from your dashboard — we confirm it quickly." },
    { t: "Start trading", d: "Pick a market, set your size, stop-loss and take-profit, and go." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <MarketTicker />
      <PublicHeader />

      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <img src={heroImg} alt="" width={1920} height={1088} className="absolute inset-0 -z-20 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/85 to-background/20" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-background to-transparent" />
        <div className="container mx-auto px-4 pb-24 pt-20 lg:pb-36 lg:pt-32">
          <div className="max-w-2xl">
            <span className="label-caps inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />{total} live markets
            </span>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-tight text-foreground md:text-7xl">
              Every market.<br /><span className="text-primary">One sharp screen.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
              Trade crypto, forex, stocks, indices and commodities with real-time prices, professional charts and risk numbers you can actually read.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-7" onClick={() => navigate("/auth")}>Open an account<ArrowRight className="ml-2 h-5 w-5" /></Button>
              <Button size="lg" variant="outline" className="h-12 bg-background/40 px-7 backdrop-blur" onClick={() => navigate("/markets")}>Explore markets</Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["Leverage on every market", "Server-side SL/TP", "Web, tablet & mobile"].map((t) => (
                <span key={t} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-primary" />{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="container relative z-10 mx-auto -mt-12 px-4">
        <div className="bento grid grid-cols-2 divide-border bg-card/90 backdrop-blur md:grid-cols-4 md:divide-x">
          {[
            [String(total), "Markets"], ["15s", "Crypto price refresh"], ["24/7", "Crypto trading"], ["5", "Asset classes"],
          ].map(([v, l]) => (
            <div key={l} className="p-6 text-center">
              <div className="num text-3xl font-semibold text-foreground md:text-4xl">{v}</div>
              <div className="mt-1 text-sm text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* LIVE MARKETS */}
      <section className="container mx-auto px-4 py-24">
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="label-caps text-primary">Live markets</p>
            <h2 className="mt-2 text-3xl font-semibold text-foreground md:text-5xl">Today's biggest movers.</h2>
            <p className="mt-3 text-muted-foreground">Real prices straight from our feed — the same ones you trade at.</p>
          </div>
          <Tabs value={cat} onValueChange={setCat}>
            <TabsList className="flex-wrap">
              {CATS.map((c) => <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>
        <div className="bento overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground md:grid-cols-[1fr_1fr_auto_auto]">
            <span>Market</span><span className="hidden md:block">Name</span><span className="text-right">Price</span><span className="w-24 text-right">24h</span>
          </div>
          {rows.length === 0 && <div className="p-10 text-center text-muted-foreground">Loading prices…</div>}
          {rows.map((a) => {
            const up = a.change_24h >= 0;
            return (
              <button key={a.id} onClick={() => navigate("/auth")}
                className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border/60 px-6 py-4 text-left transition-colors last:border-0 hover:bg-muted/40 md:grid-cols-[1fr_1fr_auto_auto]">
                <span className="num font-semibold text-foreground">{a.symbol}</span>
                <span className="hidden truncate text-sm text-muted-foreground md:block">{a.name}</span>
                <span className="num text-right text-foreground">{fmtPrice(Number(a.price))}</span>
                <span className={`num inline-flex w-24 items-center justify-end gap-1 text-right ${up ? "text-success" : "text-destructive"}`}>
                  {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {up ? "+" : ""}{Number(a.change_24h).toFixed(2)}%
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-6 text-center">
          <Button variant="ghost" onClick={() => navigate(`/markets/${cat}`)}>See all {CATS.find((c) => c.key === cat)!.label.toLowerCase()} markets<ArrowRight className="ml-2 h-4 w-4" /></Button>
        </div>
      </section>

      {/* ASSET CLASSES */}
      <section className="border-y border-border bg-sidebar">
        <div className="container mx-auto px-4 py-24">
          <div className="mb-12 max-w-2xl">
            <p className="label-caps text-primary">Asset classes</p>
            <h2 className="mt-2 text-3xl font-semibold text-foreground md:text-5xl">Five markets. One account.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {classes.map((c) => (
              <Link key={c.key} to={`/markets/${c.key}`} className="bento group p-6 transition-all hover:-translate-y-1 hover:border-primary/50">
                <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><c.icon className="h-5 w-5" /></div>
                <h3 className="text-lg font-semibold text-foreground">{c.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.text}</p>
                <div className="mt-6 flex items-center justify-between text-sm">
                  <span className="num text-muted-foreground">{counts[c.key] || "—"} markets</span>
                  <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto px-4 py-24">
        <div className="mb-12 max-w-2xl">
          <p className="label-caps text-primary">Platform</p>
          <h2 className="mt-2 text-3xl font-semibold text-foreground md:text-5xl">Built for focus, not noise.</h2>
        </div>
        <div className="grid auto-rows-fr gap-4 md:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className={`bento relative overflow-hidden p-6 ${f.span ?? ""}`}>
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></div>
              <h3 className={`${f.big ? "text-2xl" : "text-lg"} font-semibold text-foreground`}>{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              {f.big && <div className="mt-6 rounded-xl border border-border bg-background/50 p-3"><HeroChart /></div>}
            </div>
          ))}
        </div>
      </section>

      {/* DEVICES */}
      <section className="container mx-auto px-4 pb-24">
        <div className="bento grid items-center gap-10 overflow-hidden lg:grid-cols-2">
          <div className="p-8 md:p-14">
            <p className="label-caps text-primary">Trade anywhere</p>
            <h2 className="mt-2 text-3xl font-semibold text-foreground md:text-4xl">Your desk, in your pocket.</h2>
            <p className="mt-4 text-muted-foreground">The full web trader runs in any browser. Start a trade on your laptop and manage it from your phone — positions, charts and alerts stay in sync.</p>
            <ul className="mt-8 space-y-3">
              {[
                [Layers, "One-click open and close"],
                [Lock, "Encrypted, secure sign-in"],
                [Globe, "Prices around the clock"],
              ].map(([I, t]: any) => (
                <li key={t} className="flex items-center gap-3 text-foreground"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><I className="h-4 w-4" /></span>{t}</li>
              ))}
            </ul>
            <Button className="mt-10" size="lg" onClick={() => navigate("/auth")}>Launch web trader<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
          <img src={devicesImg} alt="Trading platform on laptop and phone" loading="lazy" width={1536} height={1024} className="h-full w-full object-cover" />
        </div>
      </section>

      {/* STEPS */}
      <section className="border-y border-border bg-sidebar">
        <div className="container mx-auto px-4 py-24">
          <div className="mb-12 text-center">
            <p className="label-caps text-primary">Get started</p>
            <h2 className="mt-2 text-3xl font-semibold text-foreground md:text-5xl">Live in three steps.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.t} className="bento relative p-8">
                <div className="num text-5xl font-semibold text-primary/30">0{i + 1}</div>
                <h3 className="mt-4 text-xl font-semibold text-foreground">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EDUCATION + SUPPORT */}
      <section className="container mx-auto grid gap-4 px-4 py-24 md:grid-cols-2">
        <Link to="/education" className="bento group p-8 transition-colors hover:border-primary/50">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h3 className="mt-6 text-2xl font-semibold text-foreground">Learn to trade</h3>
          <p className="mt-2 text-muted-foreground">Guides on leverage, margin, chart indicators and risk management.</p>
          <span className="mt-6 inline-flex items-center text-sm text-primary">Visit education <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
        </Link>
        <Link to="/support" className="bento group p-8 transition-colors hover:border-primary/50">
          <Headphones className="h-6 w-6 text-primary" />
          <h3 className="mt-6 text-2xl font-semibold text-foreground">Real people, real help</h3>
          <p className="mt-2 text-muted-foreground">Questions about your account, deposits or a trade? Our team is here.</p>
          <span className="mt-6 inline-flex items-center text-sm text-primary">Get support <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
        </Link>
      </section>

      {/* FAQ */}
      <section className="container mx-auto max-w-3xl px-4 pb-24">
        <h2 className="mb-8 text-center text-3xl font-semibold text-foreground md:text-4xl">Questions, answered.</h2>
        <Accordion type="single" collapsible className="w-full">
          {[
            ["What markets can I trade?", `Crypto, forex, US and European stocks, indices and commodities — ${total} markets in total.`],
            ["Where do prices come from?", "Our own price feed collects real market prices around the clock. Charts use the same prices you trade at."],
            ["How do stop-loss and take-profit work?", "They're checked on our servers on every price update, so they trigger even when your browser is closed."],
            ["How do I sign up?", "Create an account with your email and the promo code you got from your account manager."],
            ["Can I try it first?", "Yes — request a demo and we'll get in touch."],
          ].map(([q, a], i) => (
            <AccordionItem key={q} value={`q${i}`} className="border-border">
              <AccordionTrigger className="text-left text-foreground hover:text-primary">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-24">
        <div className="relative isolate overflow-hidden rounded-3xl border border-primary/30 p-10 text-center md:p-20">
          <img src={heroImg} alt="" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-50" />
          <div className="absolute inset-0 -z-10 bg-background/70" />
          <h2 className="text-3xl font-semibold text-foreground md:text-5xl">Ready when you are.</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Open your account in a couple of minutes and trade {total} markets from one screen.</p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" className="h-12 px-7" onClick={() => navigate("/auth")}>Create account<ArrowRight className="ml-2 h-5 w-5" /></Button>
            <Button size="lg" variant="outline" className="h-12 px-7" onClick={() => setIsDemoModalOpen(true)}>Request a demo</Button>
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-xs text-muted-foreground">Trading leveraged products carries a high level of risk and may not be suitable for everyone. You could lose more than your deposit.</p>
        </div>
      </section>

      <Footer />

      <Dialog open={isDemoModalOpen} onOpenChange={setIsDemoModalOpen}>
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Request a demo</DialogTitle>
            <DialogDescription className="text-muted-foreground">Leave your details and we'll get in touch.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDemoRequest} className="space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className={errors.name ? "border-destructive" : ""} />
              {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={errors.email ? "border-destructive" : ""} />
              {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Sending…" : "Send request"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
