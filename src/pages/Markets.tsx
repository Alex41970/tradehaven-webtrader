import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TrendingUp, ArrowRight, DollarSign, TrendingDown, BarChart3, Bitcoin, Wheat, Globe2, Clock, Zap } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Markets = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-trading-pattern">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate("/")}>
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
      <section className="relative py-20 overflow-hidden bg-hero-premium">
        <div className="absolute inset-0 bg-gradient-to-br from-trading-accent/5 via-transparent to-trading-primary/5"></div>
        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
              Trade Global Markets
              <span className="bg-gradient-to-r from-trading-primary via-trading-accent to-trading-primary bg-clip-text text-transparent">
                {" "}24/7
              </span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Access 10,000+ global instruments across forex, stocks, commodities, crypto & indices with institutional-grade execution
            </p>
            <Button size="lg" variant="trading" onClick={() => navigate("/auth")}>
              Start Trading Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Markets Overview Grid */}
      <section className="py-20 bg-gradient-to-b from-transparent to-muted/20 relative">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
            <Card className="group hover:shadow-2xl hover:shadow-trading-accent/20 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <div className="h-14 w-14 bg-gradient-to-br from-trading-primary/20 to-trading-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <DollarSign className="h-7 w-7 text-trading-primary" />
                </div>
                <CardTitle>Forex</CardTitle>
                <CardDescription>50+ Currency Pairs</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Trade major, minor, and exotic currency pairs with tight spreads from 0.1 pips
                </p>
                <div className="text-sm font-medium text-trading-primary">24/5 Trading Available</div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-2xl hover:shadow-trading-accent/20 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <div className="h-14 w-14 bg-gradient-to-br from-trading-accent/20 to-trading-accent/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-7 w-7 text-trading-accent" />
                </div>
                <CardTitle>Stocks & Shares</CardTitle>
                <CardDescription>5,000+ Global Stocks</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Trade US, European, and Asian stocks with fractional shares available
                </p>
                <div className="text-sm font-medium text-trading-accent">Extended Hours Trading</div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-2xl hover:shadow-trading-accent/20 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <div className="h-14 w-14 bg-gradient-to-br from-trading-success/20 to-trading-success/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Wheat className="h-7 w-7 text-trading-success" />
                </div>
                <CardTitle>Commodities</CardTitle>
                <CardDescription>Energy, Metals & Agriculture</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Gold, Silver, Oil, Natural Gas and agricultural products for portfolio diversification
                </p>
                <div className="text-sm font-medium text-trading-success">Hedge Against Inflation</div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-2xl hover:shadow-trading-accent/20 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <div className="h-14 w-14 bg-gradient-to-br from-purple-500/20 to-purple-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Bitcoin className="h-7 w-7 text-purple-500" />
                </div>
                <CardTitle>Cryptocurrencies</CardTitle>
                <CardDescription>100+ Crypto Pairs</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Bitcoin, Ethereum, and 100+ cryptocurrencies with secure wallet integration
                </p>
                <div className="text-sm font-medium text-purple-500">24/7 Trading</div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-2xl hover:shadow-trading-accent/20 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <div className="h-14 w-14 bg-gradient-to-br from-blue-500/20 to-blue-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-7 w-7 text-blue-500" />
                </div>
                <CardTitle>Indices</CardTitle>
                <CardDescription>Global Market Indices</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  S&P 500, NASDAQ, FTSE 100, DAX and more for diversified market exposure
                </p>
                <div className="text-sm font-medium text-blue-500">Track Market Sentiment</div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-2xl hover:shadow-trading-accent/20 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <div className="h-14 w-14 bg-gradient-to-br from-orange-500/20 to-orange-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Globe2 className="h-7 w-7 text-orange-500" />
                </div>
                <CardTitle>All Markets</CardTitle>
                <CardDescription>10,000+ Instruments</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Access all markets from a single platform with unified account management
                </p>
                <div className="text-sm font-medium text-orange-500">One Account, All Markets</div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Market Sections */}
          <div className="space-y-16">
            {/* Forex */}
            <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 bg-gradient-to-br from-trading-primary/20 to-trading-primary/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="h-8 w-8 text-trading-primary" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold">Forex Trading</h2>
                  <p className="text-muted-foreground">The world's largest financial market</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-xl font-semibold mb-3">Major Currency Pairs</h3>
                  <p className="text-muted-foreground mb-4">
                    Trade the most liquid currency pairs with the tightest spreads: EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, USD/CAD, and NZD/USD
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CHF"].map(pair => (
                      <span key={pair} className="px-3 py-1 bg-trading-primary/10 text-trading-primary rounded-full text-sm">
                        {pair}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3">Why Trade Forex?</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Clock className="h-5 w-5 text-trading-primary mt-0.5 flex-shrink-0" />
                      <span>24/5 trading - Open Sunday evening through Friday night</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Zap className="h-5 w-5 text-trading-primary mt-0.5 flex-shrink-0" />
                      <span>High liquidity - Over $7 trillion daily volume</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <TrendingUp className="h-5 w-5 text-trading-primary mt-0.5 flex-shrink-0" />
                      <span>Tight spreads from 0.1 pips on major pairs</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Stocks */}
            <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 bg-gradient-to-br from-trading-accent/20 to-trading-accent/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-8 w-8 text-trading-accent" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold">Stocks & Shares</h2>
                  <p className="text-muted-foreground">Invest in 5,000+ global companies</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-xl font-semibold mb-3">Popular Stocks</h3>
                  <p className="text-muted-foreground mb-4">
                    Trade leading companies from US, European, and Asian markets including tech giants, blue-chip stocks, and emerging growth companies
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA"].map(stock => (
                      <span key={stock} className="px-3 py-1 bg-trading-accent/10 text-trading-accent rounded-full text-sm font-mono">
                        {stock}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3">Features</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <TrendingUp className="h-5 w-5 text-trading-accent mt-0.5 flex-shrink-0" />
                      <span>Fractional shares - Start with any amount</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Clock className="h-5 w-5 text-trading-accent mt-0.5 flex-shrink-0" />
                      <span>Extended hours trading - Pre-market and after-hours</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <DollarSign className="h-5 w-5 text-trading-accent mt-0.5 flex-shrink-0" />
                      <span>Dividend tracking and automatic reinvestment</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Commodities */}
            <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 bg-gradient-to-br from-trading-success/20 to-trading-success/10 rounded-xl flex items-center justify-center">
                  <Wheat className="h-8 w-8 text-trading-success" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold">Commodities</h2>
                  <p className="text-muted-foreground">Diversify with tangible assets</p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Precious Metals</h3>
                  <ul className="space-y-1 text-muted-foreground text-sm">
                    <li>• Gold (XAU/USD)</li>
                    <li>• Silver (XAG/USD)</li>
                    <li>• Platinum</li>
                    <li>• Palladium</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-3">Energy</h3>
                  <ul className="space-y-1 text-muted-foreground text-sm">
                    <li>• Crude Oil (WTI)</li>
                    <li>• Brent Crude</li>
                    <li>• Natural Gas</li>
                    <li>• Heating Oil</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-3">Agricultural</h3>
                  <ul className="space-y-1 text-muted-foreground text-sm">
                    <li>• Wheat</li>
                    <li>• Corn</li>
                    <li>• Coffee</li>
                    <li>• Sugar & Cotton</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trading Features */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Trade With Us</h2>
            <p className="text-xl text-muted-foreground">Industry-leading features and execution</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
              <h3 className="text-lg font-semibold mb-2">Leverage up to 1:500</h3>
              <p className="text-sm text-muted-foreground">Maximize your trading potential with flexible leverage options</p>
            </div>
            <div className="p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
              <h3 className="text-lg font-semibold mb-2">Zero Commission</h3>
              <p className="text-sm text-muted-foreground">No commission on most instruments - just tight spreads</p>
            </div>
            <div className="p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
              <h3 className="text-lg font-semibold mb-2">Advanced Charting</h3>
              <p className="text-sm text-muted-foreground">100+ technical indicators and drawing tools</p>
            </div>
            <div className="p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
              <h3 className="text-lg font-semibold mb-2">Real-Time Data</h3>
              <p className="text-sm text-muted-foreground">Live market data and instant order execution</p>
            </div>
            <div className="p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
              <h3 className="text-lg font-semibold mb-2">Risk Management</h3>
              <p className="text-sm text-muted-foreground">Stop loss, take profit, and trailing stop orders</p>
            </div>
            <div className="p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
              <h3 className="text-lg font-semibold mb-2">Mobile & Desktop</h3>
              <p className="text-sm text-muted-foreground">Trade anywhere with our cross-platform apps</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-br from-trading-primary/10 via-card/50 to-trading-accent/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Ready to Start Trading?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join 500,000+ traders and access global markets with our award-winning platform
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="trading" onClick={() => navigate("/auth")}>
              Open Live Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="trading-outline">
              Try Demo Account
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            * CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Markets;
