import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TrendingUp, ArrowRight, Rocket, Award, BookOpen, Shield, Brain, TrendingDown, BarChart3, Clock, Lightbulb, Target, Users, Video, FileText, Calendar } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Education = () => {
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
            <div className="inline-flex items-center gap-2 bg-trading-accent/10 text-trading-accent px-4 py-2 rounded-full text-sm font-medium mb-6">
              <BookOpen className="h-4 w-4" />
              Free Education for All Traders
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
              Master the Markets
              <span className="bg-gradient-to-r from-trading-primary via-trading-accent to-trading-primary bg-clip-text text-transparent">
                {" "}from Beginner to Expert
              </span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Comprehensive education to help you succeed in trading. Free courses, tutorials, and resources for every skill level.
            </p>
            <Button size="lg" variant="trading" onClick={() => navigate("/auth")}>
              Start Learning Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Learning Paths */}
      <section className="py-20 bg-gradient-to-b from-transparent to-muted/20 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Choose Your Learning Path</h2>
            <p className="text-xl text-muted-foreground">Structured education for every level</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="group hover:shadow-2xl hover:shadow-trading-primary/20 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <div className="h-16 w-16 bg-gradient-to-br from-trading-primary/20 to-trading-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Rocket className="h-8 w-8 text-trading-primary" />
                </div>
                <CardTitle className="text-2xl">Beginner</CardTitle>
                <CardDescription>Start your trading journey</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-trading-primary mt-1">•</span>
                    <span>What is trading and how it works</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-trading-primary mt-1">•</span>
                    <span>Understanding market basics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-trading-primary mt-1">•</span>
                    <span>Opening your first trade</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-trading-primary mt-1">•</span>
                    <span>Risk management fundamentals</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-trading-primary mt-1">•</span>
                    <span>Demo account practice</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-2xl hover:shadow-trading-accent/20 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <div className="h-16 w-16 bg-gradient-to-br from-trading-accent/20 to-trading-accent/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-8 w-8 text-trading-accent" />
                </div>
                <CardTitle className="text-2xl">Intermediate</CardTitle>
                <CardDescription>Develop your skills</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-trading-accent mt-1">•</span>
                    <span>Chart patterns and formations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-trading-accent mt-1">•</span>
                    <span>Technical indicators mastery</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-trading-accent mt-1">•</span>
                    <span>Market analysis techniques</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-trading-accent mt-1">•</span>
                    <span>Developing trading strategies</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-trading-accent mt-1">•</span>
                    <span>Advanced money management</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-2xl hover:shadow-trading-success/20 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <div className="h-16 w-16 bg-gradient-to-br from-trading-success/20 to-trading-success/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Award className="h-8 w-8 text-trading-success" />
                </div>
                <CardTitle className="text-2xl">Advanced</CardTitle>
                <CardDescription>Master professional trading</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-trading-success mt-1">•</span>
                    <span>Advanced trading strategies</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-trading-success mt-1">•</span>
                    <span>Multi-timeframe analysis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-trading-success mt-1">•</span>
                    <span>Algorithmic trading concepts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-trading-success mt-1">•</span>
                    <span>Portfolio optimization</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-trading-success mt-1">•</span>
                    <span>Professional risk management</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Trading Basics */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-4">Trading Basics</h2>
            <p className="text-xl text-muted-foreground">Essential concepts every trader must understand</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-6">
              <h3 className="text-xl font-semibold mb-4">What is Trading?</h3>
              <p className="text-muted-foreground mb-4">
                Trading is the buying and selling of financial instruments to profit from price movements. Traders analyze markets, identify opportunities, and execute trades based on their strategies.
              </p>
              <p className="text-muted-foreground">
                Unlike investing for long-term growth, trading focuses on shorter-term price fluctuations across various timeframes - from seconds to months.
              </p>
            </div>

            <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-6">
              <h3 className="text-xl font-semibold mb-4">Types of Orders</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li><strong className="text-foreground">Market Order:</strong> Execute immediately at current price</li>
                <li><strong className="text-foreground">Limit Order:</strong> Execute at specified price or better</li>
                <li><strong className="text-foreground">Stop Loss:</strong> Automatically close losing position</li>
                <li><strong className="text-foreground">Take Profit:</strong> Automatically close winning position</li>
                <li><strong className="text-foreground">Stop Limit:</strong> Combination of stop and limit orders</li>
              </ul>
            </div>

            <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-6">
              <h3 className="text-xl font-semibold mb-4">Long vs Short Positions</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-trading-success" />
                    <strong className="text-foreground">Going Long (Buy)</strong>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Buying an asset expecting its price to rise. Profit when price increases.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-5 w-5 text-trading-danger" />
                    <strong className="text-foreground">Going Short (Sell)</strong>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Selling an asset expecting its price to fall. Profit when price decreases.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-6">
              <h3 className="text-xl font-semibold mb-4">Leverage & Margin</h3>
              <p className="text-muted-foreground mb-3">
                <strong className="text-foreground">Leverage</strong> allows you to control larger positions with less capital. For example, 1:100 leverage means $1,000 can control a $100,000 position.
              </p>
              <p className="text-muted-foreground mb-3">
                <strong className="text-foreground">Margin</strong> is the amount required to open and maintain leveraged positions.
              </p>
              <p className="text-sm text-trading-danger">
                ⚠️ Leverage amplifies both profits AND losses. Always use risk management.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Risk Management */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-16 w-16 bg-gradient-to-br from-trading-danger/20 to-trading-danger/10 rounded-xl flex items-center justify-center">
              <Shield className="h-8 w-8 text-trading-danger" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Risk Management</h2>
              <p className="text-xl text-muted-foreground">Protect your capital and trade sustainably</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Position Sizing</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Never risk more than 1-2% of your account on a single trade. This ensures you can survive losing streaks and stay in the game long-term.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Always Use Stop Loss</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Set a stop loss on every trade to limit potential losses. This is your safety net and prevents catastrophic account damage.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk-Reward Ratio</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Aim for minimum 1:2 risk-reward ratio. Risk $1 to potentially make $2 or more. This allows you to be profitable even with 50% win rate.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Diversification</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Don't put all your eggs in one basket. Trade multiple uncorrelated instruments to spread risk across different markets.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emotional Control</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Stick to your trading plan. Don't let fear or greed dictate your decisions. Discipline is what separates successful traders.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Capital Preservation</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Your first priority is protecting your capital. You can't trade if you've lost everything. Preserve capital first, profits second.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Technical Analysis */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-16 w-16 bg-gradient-to-br from-trading-accent/20 to-trading-accent/10 rounded-xl flex items-center justify-center">
              <BarChart3 className="h-8 w-8 text-trading-accent" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Technical Analysis</h2>
              <p className="text-xl text-muted-foreground">Reading charts and identifying opportunities</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-6">
              <h3 className="text-xl font-semibold mb-4">Chart Types & Timeframes</h3>
              <div className="space-y-3 text-muted-foreground text-sm">
                <p><strong className="text-foreground">Chart Types:</strong> Candlestick (most popular), Line, Bar charts</p>
                <p><strong className="text-foreground">Timeframes:</strong> 1m, 5m, 15m, 1h, 4h, Daily, Weekly</p>
                <p>Different timeframes show different market perspectives. Day traders focus on shorter timeframes, swing traders on longer ones.</p>
              </div>
            </div>

            <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-6">
              <h3 className="text-xl font-semibold mb-4">Trend Analysis</h3>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-trading-success mt-0.5 flex-shrink-0" />
                  <span><strong className="text-foreground">Uptrend:</strong> Higher highs and higher lows</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingDown className="h-4 w-4 text-trading-danger mt-0.5 flex-shrink-0" />
                  <span><strong className="text-foreground">Downtrend:</strong> Lower highs and lower lows</span>
                </li>
                <li className="flex items-start gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span><strong className="text-foreground">Sideways:</strong> Range-bound, no clear direction</span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">Remember: "The trend is your friend until the end"</p>
            </div>
          </div>

          <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4">Popular Technical Indicators</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Moving Averages</h4>
                <p className="text-sm text-muted-foreground">SMA and EMA smooth price data to identify trends and potential reversal points</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">RSI</h4>
                <p className="text-sm text-muted-foreground">Relative Strength Index measures momentum. Above 70 = overbought, below 30 = oversold</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">MACD</h4>
                <p className="text-sm text-muted-foreground">Moving Average Convergence Divergence shows trend strength and direction changes</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Bollinger Bands</h4>
                <p className="text-sm text-muted-foreground">Volatility bands that expand and contract. Price touching bands signals potential reversal</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Fibonacci Retracements</h4>
                <p className="text-sm text-muted-foreground">Key levels where price might retrace: 23.6%, 38.2%, 50%, 61.8%, 78.6%</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Support & Resistance</h4>
                <p className="text-sm text-muted-foreground">Price levels where buying (support) or selling (resistance) pressure is strong</p>
              </div>
            </div>
          </div>

          <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-6">
            <h3 className="text-xl font-semibold mb-4">Chart Patterns</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Reversal Patterns</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Head and Shoulders (bearish)</li>
                  <li>• Inverse Head and Shoulders (bullish)</li>
                  <li>• Double Top (bearish)</li>
                  <li>• Double Bottom (bullish)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Continuation Patterns</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Triangles (Ascending, Descending, Symmetrical)</li>
                  <li>• Flags and Pennants</li>
                  <li>• Rectangles</li>
                  <li>• Wedges</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trading Strategies */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-16 w-16 bg-gradient-to-br from-trading-primary/20 to-trading-primary/10 rounded-xl flex items-center justify-center">
              <Target className="h-8 w-8 text-trading-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Trading Strategies</h2>
              <p className="text-xl text-muted-foreground">Find the style that fits you</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <Clock className="h-8 w-8 text-trading-primary mb-2" />
                <CardTitle>Day Trading</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Open and close positions within the same trading day. Requires constant monitoring and quick decision-making.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="h-8 w-8 text-trading-accent mb-2" />
                <CardTitle>Swing Trading</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Hold positions for days to weeks. Capture larger price swings without constant monitoring.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Lightbulb className="h-8 w-8 text-trading-success mb-2" />
                <CardTitle>Scalping</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Very short-term trades lasting seconds to minutes. Many small profits add up over time.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-purple-500 mb-2" />
                <CardTitle>Position Trading</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Long-term holds (weeks to months). Based on fundamental analysis and major trends.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="h-8 w-8 text-blue-500 mb-2" />
                <CardTitle>Trend Following</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Trade with the prevailing trend. Buy in uptrends, sell in downtrends. Follow momentum.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-orange-500 mb-2" />
                <CardTitle>Range Trading</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Buy at support levels, sell at resistance. Works in sideways markets without clear trends.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Lightbulb className="h-8 w-8 text-pink-500 mb-2" />
                <CardTitle>Breakout Trading</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Trade when price breaks through key support or resistance levels with strong momentum.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Clock className="h-8 w-8 text-cyan-500 mb-2" />
                <CardTitle>News Trading</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Trade around major economic announcements and events. High risk, high reward approach.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Psychology */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-16 w-16 bg-gradient-to-br from-purple-500/20 to-purple-500/10 rounded-xl flex items-center justify-center">
              <Brain className="h-8 w-8 text-purple-500" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Psychology of Trading</h2>
              <p className="text-xl text-muted-foreground">Master your mindset for consistent success</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">Control Your Emotions</h3>
                <p className="text-sm text-muted-foreground">
                  Fear and greed are your biggest enemies. Fear causes you to exit winning trades too early. Greed makes you hold losing trades too long. Stay disciplined and follow your plan.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">Accept Losses</h3>
                <p className="text-sm text-muted-foreground">
                  Losses are part of trading. Even the best traders have losing trades. What matters is your overall edge and risk management. Accept losses, learn from them, and move on.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">Keep a Trading Journal</h3>
                <p className="text-sm text-muted-foreground">
                  Document every trade: entry, exit, reasoning, emotions, outcome. Review regularly to identify patterns in your behavior and improve your decision-making process.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">Avoid Revenge Trading</h3>
                <p className="text-sm text-muted-foreground">
                  Never try to immediately "win back" losses after a bad trade. This emotional response leads to impulsive decisions and larger losses. Take a break and return with a clear mind.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">Follow Your Plan</h3>
                <p className="text-sm text-muted-foreground">
                  Create a detailed trading plan and stick to it. Your plan should include entry/exit rules, risk management, and position sizing. Discipline beats emotion every time.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">Take Breaks</h3>
                <p className="text-sm text-muted-foreground">
                  Trading fatigue is real. After several hours of intense focus or after a series of losses, step away. Fresh perspective leads to better decisions.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Trading Glossary */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-4">Trading Glossary</h2>
            <p className="text-xl text-muted-foreground">Essential terms every trader should know</p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-2">
            <AccordionItem value="item-1" className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="font-semibold">Pip (Point in Percentage)</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The smallest price movement in forex trading. For most currency pairs, 1 pip = 0.0001. For example, if EUR/USD moves from 1.1000 to 1.1001, that's 1 pip.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="font-semibold">Spread</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The difference between the bid (sell) price and ask (buy) price. This is essentially the broker's fee. Tighter spreads mean lower trading costs.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="font-semibold">Lot</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Standard unit of trading. A standard lot = 100,000 units, mini lot = 10,000 units, micro lot = 1,000 units. Position size determines risk per pip movement.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="font-semibold">Bull Market vs Bear Market</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Bull market = prices are rising or expected to rise. Bear market = prices are falling or expected to fall. Bulls push prices up, bears push prices down.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="font-semibold">Volatility</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The degree of price fluctuation. High volatility = large price swings, more risk and opportunity. Low volatility = smaller price movements, less risk.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="font-semibold">Slippage</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                When your order is filled at a different price than expected, usually during high volatility or low liquidity. Fast execution minimizes slippage.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7" className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="font-semibold">Liquidity</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                How easily an asset can be bought or sold without affecting its price. High liquidity = easier to enter/exit positions with minimal price impact.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8" className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="font-semibold">Margin Call</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                When your account equity falls below the required margin level, broker may close your positions to prevent further losses. Avoid by proper risk management.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-9" className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="font-semibold">Drawdown</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The decline from peak to trough in your account balance. For example, if your account goes from $10,000 to $8,000, you have a 20% drawdown.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-10" className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg px-6">
              <AccordionTrigger className="hover:no-underline">
                <span className="font-semibold">Equity</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Your account balance plus or minus any floating profit/loss from open positions. This is your true account value at any given moment.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Resources */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-4">Learning Resources</h2>
            <p className="text-xl text-muted-foreground">Tools and materials to accelerate your learning</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="group hover:shadow-lg transition-all">
              <CardHeader>
                <Video className="h-10 w-10 text-trading-primary mb-2" />
                <CardTitle>Video Tutorials</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Comprehensive video library covering all aspects of trading from basics to advanced strategies
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all">
              <CardHeader>
                <Users className="h-10 w-10 text-trading-accent mb-2" />
                <CardTitle>Weekly Webinars</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Join live sessions with professional traders sharing insights and answering questions
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all">
              <CardHeader>
                <FileText className="h-10 w-10 text-trading-success mb-2" />
                <CardTitle>Trading Guides</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Downloadable PDFs and ebooks covering specific strategies and market analysis techniques
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all">
              <CardHeader>
                <Calendar className="h-10 w-10 text-purple-500 mb-2" />
                <CardTitle>Economic Calendar</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Track important economic events and announcements that impact market movements
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Practice CTA */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-br from-trading-primary/10 via-card/50 to-trading-accent/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Practice Risk-Free with Demo Account</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Try our platform with $100,000 virtual money. All real market conditions, zero risk.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="trading" onClick={() => navigate("/auth")}>
              Get Free Demo Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="trading-outline">
              Browse More Resources
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Education;
